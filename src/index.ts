import "dotenv/config";

import express from "express";
import { InlineKeyboard } from "grammy";
import { Bot, webhookCallback } from "grammy";
import type { Context } from "grammy";
import { AppointmentStatus, Prisma } from "@prisma/client";

import { prisma } from "./lib/prisma.js";

const botToken = process.env.BOT_TOKEN;

if (!botToken) {
  throw new Error("BOT_TOKEN is not set");
}

const port = Number(process.env.PORT ?? 3000);
const botTimeZone = process.env.BOT_TIMEZONE ?? "Europe/Moscow";
const app = express();
const bot = new Bot(botToken);

const DAYS_TO_SHOW = 7;
const SLOT_STEP_MINUTES = 30;
const CALLBACK = {
  service: "svc",
  date: "dt",
  confirm: "cfm",
  cancel: "cancel",
  backServices: "back_services",
  myAppointments: "my_appointments",
  masterAppointments: "master_appointments",
} as const;

type AppContext = Context;
type Slot = { startsAt: Date; endsAt: Date };

function formatMoney(price: Prisma.Decimal | null): string {
  if (price === null) {
    return "";
  }

  return ` - ${new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(price.toNumber())}`;
}

function formatDateLabel(date: Date): string {
  return new Intl.DateTimeFormat("ru-RU", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    timeZone: botTimeZone,
  }).format(date);
}

function formatDateTime(date: Date): string {
  return new Intl.DateTimeFormat("ru-RU", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: botTimeZone,
  }).format(date);
}

function toDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function startOfDayUtc(dateKey: string): Date {
  return new Date(`${dateKey}T00:00:00.000Z`);
}

function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60_000);
}

function getWeekday(date: Date): number {
  const day = date.getUTCDay();
  return day === 0 ? 7 : day;
}

function parseTimeToMinutes(value: string): number {
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

function buildSlotDate(day: Date, time: string): Date {
  const minutes = parseTimeToMinutes(time);
  return addMinutes(day, minutes);
}

function intersects(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): boolean {
  return aStart < bEnd && bStart < aEnd;
}

async function ensureUser(ctx: AppContext) {
  if (!ctx.from) {
    throw new Error("Telegram user info is missing");
  }

  return prisma.user.upsert({
    where: { telegramId: BigInt(ctx.from.id) },
    create: {
      telegramId: BigInt(ctx.from.id),
      username: ctx.from.username,
      firstName: ctx.from.first_name,
    },
    update: {
      username: ctx.from.username,
      firstName: ctx.from.first_name,
    },
  });
}

async function getServiceById(serviceId: number) {
  return prisma.service.findUnique({
    where: { id: serviceId },
    include: { master: true },
  });
}

async function getMasterByTelegramChatId(chatId: number | bigint) {
  return prisma.master.findFirst({
    where: {
      telegramChatId: BigInt(chatId),
    },
  });
}

async function getAvailableSlots(serviceId: number, dateKey: string): Promise<Slot[]> {
  const service = await prisma.service.findUnique({
    where: { id: serviceId },
    include: { master: true },
  });

  if (!service || !service.isActive) {
    return [];
  }

  const dayStart = startOfDayUtc(dateKey);
  const dayEnd = addMinutes(dayStart, 24 * 60);
  const weekday = getWeekday(dayStart);

  const [workingHour, appointments, blockedSlots] = await Promise.all([
    prisma.workingHour.findFirst({
      where: {
        masterId: service.masterId,
        weekday,
        isActive: true,
      },
    }),
    prisma.appointment.findMany({
      where: {
        masterId: service.masterId,
        status: AppointmentStatus.BOOKED,
        startsAt: { lt: dayEnd },
        endsAt: { gt: dayStart },
      },
    }),
    prisma.blockedSlot.findMany({
      where: {
        masterId: service.masterId,
        startsAt: { lt: dayEnd },
        endsAt: { gt: dayStart },
      },
    }),
  ]);

  if (!workingHour) {
    return [];
  }

  const slots: Slot[] = [];
  const windowStart = buildSlotDate(dayStart, workingHour.startTime);
  const windowEnd = buildSlotDate(dayStart, workingHour.endTime);

  for (
    let current = new Date(windowStart);
    addMinutes(current, service.durationMinutes) <= windowEnd;
    current = addMinutes(current, SLOT_STEP_MINUTES)
  ) {
    const slotStart = new Date(current);
    const slotEnd = addMinutes(slotStart, service.durationMinutes);
    const busy = appointments.some((appointment) =>
      intersects(slotStart, slotEnd, appointment.startsAt, appointment.endsAt),
    );
    const blocked = blockedSlots.some((blockedSlot) =>
      intersects(slotStart, slotEnd, blockedSlot.startsAt, blockedSlot.endsAt),
    );

    if (!busy && !blocked && slotStart > new Date()) {
      slots.push({ startsAt: slotStart, endsAt: slotEnd });
    }
  }

  return slots;
}

async function renderServicesMenu(ctx: AppContext, text?: string) {
  const services = await prisma.service.findMany({
    where: { isActive: true },
    include: { master: true },
    orderBy: [{ master: { name: "asc" } }, { name: "asc" }],
  });

  if (services.length === 0) {
    await ctx.reply("Пока нет доступных услуг. Добавьте записи в таблицу services.");
    return;
  }

  const keyboard = new InlineKeyboard();

  for (const service of services) {
    keyboard.text(
      `${service.name} · ${service.durationMinutes} мин${formatMoney(service.price)}`,
      `${CALLBACK.service}:${service.id}`,
    );
    keyboard.row();
  }

  keyboard.text("Мои записи", CALLBACK.myAppointments);

  await ctx.reply(
    text ?? "Выберите услугу для записи:",
    { reply_markup: keyboard },
  );
}

async function renderDatesMenu(ctx: AppContext, serviceId: number) {
  const service = await getServiceById(serviceId);

  if (!service || !service.isActive) {
    await ctx.reply("Эта услуга недоступна.");
    return;
  }

  const keyboard = new InlineKeyboard();
  let hasDates = false;

  for (let offset = 0; offset < DAYS_TO_SHOW; offset += 1) {
    const date = addMinutes(startOfDayUtc(toDateKey(new Date())), offset * 24 * 60);
    const dateKey = toDateKey(date);
    const slots = await getAvailableSlots(serviceId, dateKey);

    if (slots.length > 0) {
      keyboard.text(formatDateLabel(date), `${CALLBACK.date}:${serviceId}:${dateKey}`);
      keyboard.row();
      hasDates = true;
    }
  }

  keyboard.text("Назад к услугам", CALLBACK.backServices);

  if (!hasDates) {
    await ctx.reply(
      `У мастера ${service.master.name} пока нет свободных дат для услуги "${service.name}".`,
      { reply_markup: keyboard },
    );
    return;
  }

  await ctx.reply(
    `Услуга: ${service.name}\nМастер: ${service.master.name}\n\nВыберите дату:`,
    { reply_markup: keyboard },
  );
}

async function renderSlotsMenu(ctx: AppContext, serviceId: number, dateKey: string) {
  const service = await getServiceById(serviceId);

  if (!service || !service.isActive) {
    await ctx.reply("Эта услуга недоступна.");
    return;
  }

  const slots = await getAvailableSlots(serviceId, dateKey);
  const keyboard = new InlineKeyboard();

  if (slots.length === 0) {
    keyboard.text("Выбрать другую дату", `${CALLBACK.service}:${serviceId}`);
    keyboard.row();
    keyboard.text("Назад к услугам", CALLBACK.backServices);

    await ctx.reply("На эту дату свободных слотов уже нет.", {
      reply_markup: keyboard,
    });
    return;
  }

  for (const slot of slots) {
    const time = new Intl.DateTimeFormat("ru-RU", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone: botTimeZone,
    }).format(slot.startsAt);
    keyboard.text(time, `${CALLBACK.confirm}:${serviceId}:${slot.startsAt.toISOString()}`);
  }

  keyboard.row();
  keyboard.text("Выбрать другую дату", `${CALLBACK.service}:${serviceId}`);
  keyboard.row();
  keyboard.text("Назад к услугам", CALLBACK.backServices);

  await ctx.reply(
    `Дата: ${formatDateLabel(startOfDayUtc(dateKey))}\nВыберите свободное время:`,
    { reply_markup: keyboard },
  );
}

async function notifyMaster(appointmentId: number) {
  const appointment = await prisma.appointment.findUnique({
    where: { id: appointmentId },
    include: {
      service: true,
      master: true,
      user: true,
    },
  });

  if (!appointment?.master.telegramChatId) {
    return;
  }

  await bot.api.sendMessage(
    Number(appointment.master.telegramChatId),
    [
      "Новая запись",
      `Услуга: ${appointment.service.name}`,
      `Клиент: ${appointment.user.firstName ?? appointment.user.username ?? "Без имени"}`,
      `Время: ${formatDateTime(appointment.startsAt)}`,
    ].join("\n"),
  );
}

async function notifyMasterAboutCancellation(appointmentId: number) {
  const appointment = await prisma.appointment.findUnique({
    where: { id: appointmentId },
    include: {
      service: true,
      master: true,
      user: true,
    },
  });

  if (!appointment?.master.telegramChatId) {
    return;
  }

  await bot.api.sendMessage(
    Number(appointment.master.telegramChatId),
    [
      "Запись отменена клиентом",
      `Услуга: ${appointment.service.name}`,
      `Клиент: ${appointment.user.firstName ?? appointment.user.username ?? "Без имени"}`,
      `Время: ${formatDateTime(appointment.startsAt)}`,
    ].join("\n"),
  );
}

async function renderMasterAppointments(ctx: AppContext, masterId: number) {
  const master = await prisma.master.findUnique({
    where: { id: masterId },
  });

  if (!master) {
    await ctx.reply("Мастер не найден.");
    return;
  }

  const appointments = await prisma.appointment.findMany({
    where: {
      masterId,
      status: AppointmentStatus.BOOKED,
      startsAt: { gte: new Date() },
    },
    include: {
      service: true,
      user: true,
    },
    orderBy: { startsAt: "asc" },
    take: 10,
  });

  const keyboard = new InlineKeyboard().text("Обновить список", CALLBACK.masterAppointments);

  if (appointments.length === 0) {
    await ctx.reply(`У мастера ${master.name} пока нет ближайших активных записей.`, {
      reply_markup: keyboard,
    });
    return;
  }

  const lines = appointments.flatMap((appointment, index) => {
    const customer = appointment.customerName
      ?? appointment.user.firstName
      ?? appointment.user.username
      ?? "Без имени";

    return [
      `${index + 1}. ${formatDateTime(appointment.startsAt)}`,
      `Услуга: ${appointment.service.name}`,
      `Клиент: ${customer}`,
      "",
    ];
  });

  await ctx.reply(
    [`Ближайшие записи мастера ${master.name}:`, "", ...lines].join("\n").trim(),
    { reply_markup: keyboard },
  );
}

async function bindMasterToCurrentChat(ctx: AppContext, masterId: number) {
  if (!ctx.chat) {
    await ctx.reply("Не удалось определить чат.");
    return;
  }

  const master = await prisma.master.findUnique({
    where: { id: masterId },
  });

  if (!master) {
    await ctx.reply(`Мастер с ID ${masterId} не найден.`);
    return;
  }

  await prisma.master.update({
    where: { id: masterId },
    data: {
      telegramChatId: BigInt(ctx.chat.id),
    },
  });

  await ctx.reply(
    `Чат привязан к мастеру ${master.name}. Теперь новые записи будут приходить сюда.\n\nДля просмотра бронирований используйте /master`,
  );

  await renderMasterAppointments(ctx, masterId);
}

async function openMasterPanel(ctx: AppContext) {
  if (!ctx.chat) {
    await ctx.reply("Не удалось определить чат.");
    return;
  }

  const master = await getMasterByTelegramChatId(ctx.chat.id);

  if (!master) {
    await ctx.reply(
      "Этот чат еще не привязан к мастеру.\n\nИспользуйте команду /master ID_МАСТЕРА, например: /master 1",
    );
    return;
  }

  await renderMasterAppointments(ctx, master.id);
}

async function confirmAppointment(ctx: AppContext, serviceId: number, startsAtIso: string) {
  const user = await ensureUser(ctx);
  const service = await getServiceById(serviceId);

  if (!service || !service.isActive) {
    await ctx.reply("Эта услуга недоступна.");
    return;
  }

  const startsAt = new Date(startsAtIso);
  const endsAt = addMinutes(startsAt, service.durationMinutes);

  if (Number.isNaN(startsAt.getTime())) {
    await ctx.reply("Не удалось прочитать выбранное время.");
    return;
  }

  const slotStillAvailable = await prisma.appointment.findFirst({
    where: {
      masterId: service.masterId,
      status: AppointmentStatus.BOOKED,
      startsAt: { lt: endsAt },
      endsAt: { gt: startsAt },
    },
  });

  const blocked = await prisma.blockedSlot.findFirst({
    where: {
      masterId: service.masterId,
      startsAt: { lt: endsAt },
      endsAt: { gt: startsAt },
    },
  });

  if (slotStillAvailable || blocked) {
    await ctx.reply("Этот слот уже занят. Пожалуйста, выберите другое время.");
    await renderSlotsMenu(ctx, serviceId, toDateKey(startsAt));
    return;
  }

  const appointment = await prisma.appointment.create({
    data: {
      userId: user.id,
      masterId: service.masterId,
      serviceId,
      startsAt,
      endsAt,
      customerName: ctx.from?.first_name,
    },
  });

  const cancelKeyboard = new InlineKeyboard().text(
    "Отменить запись",
    `${CALLBACK.cancel}:${appointment.id}`,
  );

  await ctx.reply(
    [
      "Запись подтверждена.",
      `Услуга: ${service.name}`,
      `Мастер: ${service.master.name}`,
      `Время: ${formatDateTime(startsAt)}`,
    ].join("\n"),
    { reply_markup: cancelKeyboard },
  );

  await notifyMaster(appointment.id);
}

async function renderMyAppointments(ctx: AppContext) {
  const user = await ensureUser(ctx);
  const appointments = await prisma.appointment.findMany({
    where: {
      userId: user.id,
      status: AppointmentStatus.BOOKED,
      startsAt: { gte: new Date() },
    },
    include: {
      service: true,
      master: true,
    },
    orderBy: { startsAt: "asc" },
  });

  if (appointments.length === 0) {
    await ctx.reply("У вас пока нет активных записей.");
    return;
  }

  for (const appointment of appointments) {
    const keyboard = new InlineKeyboard().text(
      "Отменить запись",
      `${CALLBACK.cancel}:${appointment.id}`,
    );
    await ctx.reply(
      [
        `Услуга: ${appointment.service.name}`,
        `Мастер: ${appointment.master.name}`,
        `Время: ${formatDateTime(appointment.startsAt)}`,
      ].join("\n"),
      { reply_markup: keyboard },
    );
  }
}

bot.command("start", async (ctx) => {
  await ensureUser(ctx);
  await renderServicesMenu(ctx, "Добро пожаловать. Выберите услугу:");
});

bot.command("my_appointments", async (ctx) => {
  await renderMyAppointments(ctx);
});

bot.command("master", async (ctx) => {
  const text = ctx.message?.text ?? "";
  const [, rawMasterId] = text.trim().split(/\s+/, 2);

  if (rawMasterId) {
    const masterId = Number(rawMasterId);

    if (!Number.isInteger(masterId) || masterId <= 0) {
      await ctx.reply("Укажите корректный ID мастера. Пример: /master 1");
      return;
    }

    await bindMasterToCurrentChat(ctx, masterId);
    return;
  }

  await openMasterPanel(ctx);
});

bot.callbackQuery(CALLBACK.myAppointments, async (ctx) => {
  await ctx.answerCallbackQuery();
  await renderMyAppointments(ctx);
});

bot.callbackQuery(CALLBACK.backServices, async (ctx) => {
  await ctx.answerCallbackQuery();
  await renderServicesMenu(ctx);
});

bot.callbackQuery(CALLBACK.masterAppointments, async (ctx) => {
  await ctx.answerCallbackQuery();
  await openMasterPanel(ctx);
});

bot.callbackQuery(new RegExp(`^${CALLBACK.service}:(\\d+)$`), async (ctx) => {
  const serviceId = Number(ctx.match?.[1]);
  await ctx.answerCallbackQuery();
  await renderDatesMenu(ctx, serviceId);
});

bot.callbackQuery(new RegExp(`^${CALLBACK.date}:(\\d+):(\\d{4}-\\d{2}-\\d{2})$`), async (ctx) => {
  const serviceId = Number(ctx.match?.[1]);
  const dateKey = String(ctx.match?.[2]);
  await ctx.answerCallbackQuery();
  await renderSlotsMenu(ctx, serviceId, dateKey);
});

bot.callbackQuery(new RegExp(`^${CALLBACK.confirm}:(\\d+):(.+)$`), async (ctx) => {
  const serviceId = Number(ctx.match?.[1]);
  const startsAtIso = String(ctx.match?.[2]);
  await ctx.answerCallbackQuery();
  await confirmAppointment(ctx, serviceId, startsAtIso);
});

bot.callbackQuery(new RegExp(`^${CALLBACK.cancel}:(\\d+)$`), async (ctx) => {
  const appointmentId = Number(ctx.match?.[1]);
  const user = await ensureUser(ctx);
  const appointment = await prisma.appointment.findFirst({
    where: {
      id: appointmentId,
      userId: user.id,
      status: AppointmentStatus.BOOKED,
    },
    include: {
      service: true,
      master: true,
    },
  });

  if (!appointment) {
    await ctx.answerCallbackQuery({ text: "Запись не найдена или уже отменена." });
    return;
  }

  await prisma.appointment.update({
    where: { id: appointment.id },
    data: {
      status: AppointmentStatus.CANCELED,
      canceledAt: new Date(),
    },
  });

  await ctx.answerCallbackQuery({ text: "Запись отменена" });
  await ctx.reply(
    [
      "Запись отменена.",
      `Услуга: ${appointment.service.name}`,
      `Время: ${formatDateTime(appointment.startsAt)}`,
    ].join("\n"),
  );

  await notifyMasterAboutCancellation(appointment.id);
});

bot.catch((error) => {
  console.error("Bot error", error.error);
});

app.get("/health", async (_req, res) => {
  await prisma.$queryRaw`SELECT 1`;
  res.json({ ok: true });
});

if (process.env.NODE_ENV === "production") {
  app.use(express.json());
  app.use("/webhook", webhookCallback(bot, "express"));
} else {
  void bot.start();
}

app.listen(port, () => {
  console.log(`Server listening on http://localhost:${port}`);
});
