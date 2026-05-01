import { formatDateTime } from "../../utils/datetime.js";

type MasterName = { name: string };
type AppointmentLineInput = {
  startsAt: Date;
  service: { name: string };
  user: { firstName: string | null; username: string | null };
  customerName: string | null;
};

export function getMasterNotFoundText() {
  return "Мастер не найден.";
}

export function getNoMasterAppointmentsText(master: MasterName) {
  return `У мастера ${master.name} пока нет ближайших активных записей.`;
}

export function getMasterAppointmentsText(master: MasterName, appointments: AppointmentLineInput[]) {
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

  return [`Ближайшие записи мастера ${master.name}:`, "", ...lines].join("\n").trim();
}

export function getChatUnavailableText() {
  return "Не удалось определить чат.";
}

export function getMasterIdNotFoundText(masterId: number) {
  return `Мастер с ID ${masterId} не найден.`;
}

export function getMasterBoundText(master: MasterName) {
  return `Чат привязан к мастеру ${master.name}. Теперь новые записи будут приходить сюда.\n\nДля просмотра бронирований используйте /master`;
}

export function getMasterBindHintText() {
  return "Этот чат еще не привязан к мастеру.\n\nИспользуйте команду /master ID_МАСТЕРА, например: /master 1";
}
