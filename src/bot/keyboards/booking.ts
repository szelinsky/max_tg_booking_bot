import { InlineKeyboard } from "grammy";
import { Prisma } from "@prisma/client";

import { CALLBACK } from "../callback-data.js";
import type { Slot } from "../../types/booking.js";
import { formatDateLabel, formatTime, startOfDayUtc } from "../../utils/datetime.js";
import { formatMoney } from "../../utils/money.js";

type ServiceListItem = Prisma.ServiceGetPayload<{
  include: { master: true };
}>;

export function buildServicesKeyboard(services: ServiceListItem[]) {
  const keyboard = new InlineKeyboard();

  for (const service of services) {
    keyboard.text(
      `${service.name} · ${service.durationMinutes} мин${formatMoney(service.price)}`,
      `${CALLBACK.service}:${service.id}`,
    );
    keyboard.row();
  }

  keyboard.text("Мои записи", CALLBACK.myAppointments);

  return keyboard;
}

export function buildDatesKeyboard(serviceId: number, dateKeys: string[]) {
  const keyboard = new InlineKeyboard();

  for (const dateKey of dateKeys) {
    keyboard.text(formatDateLabel(startOfDayUtc(dateKey)), `${CALLBACK.date}:${serviceId}:${dateKey}`);
    keyboard.row();
  }

  keyboard.text("Назад к услугам", CALLBACK.backServices);

  return keyboard;
}

export function buildSlotsKeyboard(serviceId: number, slots: Slot[]) {
  const keyboard = new InlineKeyboard();

  if (slots.length === 0) {
    keyboard.text("Выбрать другую дату", `${CALLBACK.service}:${serviceId}`);
    keyboard.row();
    keyboard.text("Назад к услугам", CALLBACK.backServices);
    return keyboard;
  }

  const buttonsPerRow = slots.length <= 3 ? 1 : slots.length <= 8 ? 2 : 3;

  slots.forEach((slot, index) => {
    keyboard.text(
      formatTime(slot.startsAt),
      `${CALLBACK.confirm}:${serviceId}:${slot.startsAt.toISOString()}`,
    );

    if ((index + 1) % buttonsPerRow === 0 && index < slots.length - 1) {
      keyboard.row();
    }
  });

  keyboard.row();
  keyboard.text("Выбрать другую дату", `${CALLBACK.service}:${serviceId}`);
  keyboard.row();
  keyboard.text("Назад к услугам", CALLBACK.backServices);

  return keyboard;
}

export function buildMasterAppointmentsKeyboard() {
  return new InlineKeyboard().text("Обновить список", CALLBACK.masterAppointments);
}

export function buildCancelAppointmentKeyboard(appointmentId: number) {
  return new InlineKeyboard().text("Отменить запись", `${CALLBACK.cancel}:${appointmentId}`);
}
