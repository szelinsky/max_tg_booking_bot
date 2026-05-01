import type { Bot } from "grammy";

import { DAYS_TO_SHOW } from "../app/constants.js";
import {
  buildCancelAppointmentKeyboard,
  buildDatesKeyboard,
  buildMasterAppointmentsKeyboard,
  buildServicesKeyboard,
  buildSlotsKeyboard,
} from "./keyboards/booking.js";
import {
  getAppointmentConfirmedText,
  getUserAppointmentText,
} from "./messages/appointments.js";
import {
  getDatesMenuText,
  getNoDatesText,
  getNoServicesText,
  getNoSlotsText,
  getServiceUnavailableText,
  getServicesMenuText,
  getSlotsMenuText,
} from "./messages/booking.js";
import {
  getChatUnavailableText,
  getMasterAppointmentsText,
  getMasterBindHintText,
  getMasterBoundText,
  getMasterIdNotFoundText,
  getMasterNotFoundText,
  getNoMasterAppointmentsText,
} from "./messages/master.js";
import type { AppContext } from "./context.js";
import {
  cancelAppointment,
  confirmAppointment as confirmAppointmentService,
  getUserActiveAppointments,
} from "../services/booking.service.js";
import { getActiveServices, getServiceById } from "../services/catalog.service.js";
import {
  bindMasterChat,
  getMasterById,
  getMasterByTelegramChatId,
  getUpcomingMasterAppointments,
} from "../services/master.service.js";
import { getAvailableDateKeys, getAvailableSlots } from "../services/schedule.service.js";
import { formatDateLabel, startOfDayUtc } from "../utils/datetime.js";

export async function renderServicesMenu(ctx: AppContext, text?: string) {
  const services = await getActiveServices();

  if (services.length === 0) {
    await ctx.reply(getNoServicesText());
    return;
  }

  await ctx.reply(getServicesMenuText(text), {
    reply_markup: buildServicesKeyboard(services),
  });
}

export async function renderDatesMenu(ctx: AppContext, serviceId: number) {
  const service = await getServiceById(serviceId);

  if (!service || !service.isActive) {
    await ctx.reply(getServiceUnavailableText());
    return;
  }

  const availableDateKeys = await getAvailableDateKeys(serviceId, DAYS_TO_SHOW);
  const keyboard = buildDatesKeyboard(serviceId, availableDateKeys);

  if (availableDateKeys.length === 0) {
    await ctx.reply(getNoDatesText(service.master.name, service.name), {
      reply_markup: keyboard,
    });
    return;
  }

  await ctx.reply(getDatesMenuText(service.name, service.master.name), {
    reply_markup: keyboard,
  });
}

export async function renderSlotsMenu(ctx: AppContext, serviceId: number, dateKey: string) {
  const service = await getServiceById(serviceId);

  if (!service || !service.isActive) {
    await ctx.reply(getServiceUnavailableText());
    return;
  }

  const slots = await getAvailableSlots(serviceId, dateKey);
  const keyboard = buildSlotsKeyboard(serviceId, slots);

  if (slots.length === 0) {
    await ctx.reply(getNoSlotsText(), {
      reply_markup: keyboard,
    });
    return;
  }

  await ctx.reply(getSlotsMenuText(formatDateLabel(startOfDayUtc(dateKey))), {
    reply_markup: keyboard,
  });
}

export async function renderMasterAppointments(ctx: AppContext, masterId: number) {
  const master = await getMasterById(masterId);

  if (!master) {
    await ctx.reply(getMasterNotFoundText());
    return;
  }

  const appointments = await getUpcomingMasterAppointments(masterId);
  const keyboard = buildMasterAppointmentsKeyboard();

  if (appointments.length === 0) {
    await ctx.reply(getNoMasterAppointmentsText(master), {
      reply_markup: keyboard,
    });
    return;
  }

  await ctx.reply(getMasterAppointmentsText(master, appointments), { reply_markup: keyboard });
}

export async function bindMasterToCurrentChat(ctx: AppContext, masterId: number) {
  if (!ctx.chat) {
    await ctx.reply(getChatUnavailableText());
    return;
  }

  const master = await getMasterById(masterId);

  if (!master) {
    await ctx.reply(getMasterIdNotFoundText(masterId));
    return;
  }

  await bindMasterChat(masterId, ctx.chat.id);
  await ctx.reply(getMasterBoundText(master));
  await renderMasterAppointments(ctx, masterId);
}

export async function openMasterPanel(ctx: AppContext) {
  if (!ctx.chat) {
    await ctx.reply(getChatUnavailableText());
    return;
  }

  const master = await getMasterByTelegramChatId(ctx.chat.id);

  if (!master) {
    await ctx.reply(getMasterBindHintText());
    return;
  }

  await renderMasterAppointments(ctx, master.id);
}

export async function confirmAppointmentFlow(
  ctx: AppContext,
  bot: Bot,
  serviceId: number,
  startsAtIso: string,
) {
  const result = await confirmAppointmentService(ctx, bot, serviceId, startsAtIso);

  if (!result.ok && result.reason === "service_unavailable") {
    await ctx.reply(getServiceUnavailableText());
    return;
  }

  if (!result.ok && result.reason === "invalid_time") {
    await ctx.reply("Не удалось прочитать выбранное время.");
    return;
  }

  if (!result.ok && result.reason === "slot_unavailable") {
    await ctx.reply("Этот слот уже занят. Пожалуйста, выберите другое время.");
    await renderSlotsMenu(ctx, serviceId, result.dateKey);
    return;
  }

  await ctx.reply(getAppointmentConfirmedText({
    service: result.service,
    master: result.service.master,
    startsAt: result.startsAt,
  }), { reply_markup: buildCancelAppointmentKeyboard(result.appointment.id) });
}

export async function renderMyAppointments(ctx: AppContext) {
  const appointments = await getUserActiveAppointments(ctx);

  if (appointments.length === 0) {
    await ctx.reply("У вас пока нет активных записей.");
    return;
  }

  for (const appointment of appointments) {
    await ctx.reply(getUserAppointmentText(appointment), {
      reply_markup: buildCancelAppointmentKeyboard(appointment.id),
    });
  }
}

export async function cancelAppointmentFlow(ctx: AppContext, bot: Bot, appointmentId: number) {
  return cancelAppointment(ctx, bot, appointmentId);
}
