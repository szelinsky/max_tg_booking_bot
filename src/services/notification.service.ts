import type { Bot } from "grammy";

import {
  getMasterCancellationNotificationText,
  getMasterNotificationText,
} from "../bot/messages/appointments.js";
import { prisma } from "../lib/prisma.js";

export async function notifyMaster(bot: Bot, appointmentId: number) {
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
    getMasterNotificationText(appointment),
  );
}

export async function notifyMasterAboutCancellation(bot: Bot, appointmentId: number) {
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
    getMasterCancellationNotificationText(appointment),
  );
}
