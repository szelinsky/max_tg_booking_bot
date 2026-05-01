import { AppointmentStatus } from "@prisma/client";

import { prisma } from "../lib/prisma.js";

export function getMasterByTelegramChatId(chatId: number | bigint) {
  return prisma.master.findFirst({
    where: {
      telegramChatId: BigInt(chatId),
    },
  });
}

export function getMasterById(masterId: number) {
  return prisma.master.findUnique({
    where: { id: masterId },
  });
}

export function bindMasterChat(masterId: number, chatId: number | bigint) {
  return prisma.master.update({
    where: { id: masterId },
    data: {
      telegramChatId: BigInt(chatId),
    },
  });
}

export function getUpcomingMasterAppointments(masterId: number) {
  return prisma.appointment.findMany({
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
}
