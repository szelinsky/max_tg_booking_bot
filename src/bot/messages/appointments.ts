import { formatDateTime } from "../../utils/datetime.js";

type NamedService = { name: string };
type NamedMaster = { name: string };
type NamedUser = { firstName: string | null; username: string | null };

export function getMasterNotificationText(input: {
  service: NamedService;
  user: NamedUser;
  startsAt: Date;
}) {
  return [
    "Новая запись",
    `Услуга: ${input.service.name}`,
    `Клиент: ${input.user.firstName ?? input.user.username ?? "Без имени"}`,
    `Время: ${formatDateTime(input.startsAt)}`,
  ].join("\n");
}

export function getMasterCancellationNotificationText(input: {
  service: NamedService;
  user: NamedUser;
  startsAt: Date;
}) {
  return [
    "Запись отменена клиентом",
    `Услуга: ${input.service.name}`,
    `Клиент: ${input.user.firstName ?? input.user.username ?? "Без имени"}`,
    `Время: ${formatDateTime(input.startsAt)}`,
  ].join("\n");
}

export function getAppointmentConfirmedText(input: {
  service: NamedService;
  master: NamedMaster;
  startsAt: Date;
}) {
  return [
    "Запись подтверждена.",
    `Услуга: ${input.service.name}`,
    `Мастер: ${input.master.name}`,
    `Время: ${formatDateTime(input.startsAt)}`,
  ].join("\n");
}

export function getAppointmentCanceledText(input: {
  service: NamedService;
  startsAt: Date;
}) {
  return [
    "Запись отменена.",
    `Услуга: ${input.service.name}`,
    `Время: ${formatDateTime(input.startsAt)}`,
  ].join("\n");
}

export function getUserAppointmentText(input: {
  service: NamedService;
  master: NamedMaster;
  startsAt: Date;
}) {
  return [
    `Услуга: ${input.service.name}`,
    `Мастер: ${input.master.name}`,
    `Время: ${formatDateTime(input.startsAt)}`,
  ].join("\n");
}
