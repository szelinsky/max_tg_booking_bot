export function getServicesMenuText(text?: string) {
  return text ?? "Выберите услугу для записи:";
}

export function getNoServicesText() {
  return "Пока нет доступных услуг. Добавьте записи в таблицу services.";
}

export function getServiceUnavailableText() {
  return "Эта услуга недоступна.";
}

export function getNoDatesText(masterName: string, serviceName: string) {
  return `У мастера ${masterName} пока нет свободных дат для услуги "${serviceName}".`;
}

export function getDatesMenuText(serviceName: string, masterName: string) {
  return `Услуга: ${serviceName}\nМастер: ${masterName}\n\nВыберите дату:`;
}

export function getNoSlotsText() {
  return "На эту дату свободных слотов уже нет.";
}

export function getSlotsMenuText(dateLabel: string) {
  return `Дата: ${dateLabel}\nВыберите свободное время:`;
}
