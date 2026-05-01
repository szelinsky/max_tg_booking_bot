import { AppointmentStatus } from "@prisma/client";
import type { Bot, Context } from "grammy";

import { prisma } from "../lib/prisma.js";
import { addMinutes, toDateKey } from "../utils/datetime.js";
import { getServiceById } from "./catalog.service.js";
import { notifyMaster, notifyMasterAboutCancellation } from "./notification.service.js";
import { ensureUser } from "./user.service.js";

export async function confirmAppointment(ctx: Context, bot: Bot, serviceId: number, startsAtIso: string) {
  const user = await ensureUser(ctx);
  const service = await getServiceById(serviceId);

  if (!service || !service.isActive) {
    return { ok: false as const, reason: "service_unavailable" as const };
  }

  const startsAt = new Date(startsAtIso);

  if (Number.isNaN(startsAt.getTime())) {
    return { ok: false as const, reason: "invalid_time" as const };
  }

  const endsAt = addMinutes(startsAt, service.durationMinutes);
  const [slotStillAvailable, blocked] = await Promise.all([
    prisma.appointment.findFirst({
      where: {
        masterId: service.masterId,
        status: AppointmentStatus.BOOKED,
        startsAt: { lt: endsAt },
        endsAt: { gt: startsAt },
      },
    }),
    prisma.blockedSlot.findFirst({
      where: {
        masterId: service.masterId,
        startsAt: { lt: endsAt },
        endsAt: { gt: startsAt },
      },
    }),
  ]);

  if (slotStillAvailable || blocked) {
    return {
      ok: false as const,
      reason: "slot_unavailable" as const,
      dateKey: toDateKey(startsAt),
    };
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

  await notifyMaster(bot, appointment.id);

  return {
    ok: true as const,
    appointment,
    service,
    startsAt,
  };
}

export async function getUserActiveAppointments(ctx: Context) {
  const user = await ensureUser(ctx);

  return prisma.appointment.findMany({
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
}

export async function cancelAppointment(ctx: Context, bot: Bot, appointmentId: number) {
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
    return { ok: false as const, reason: "not_found" as const };
  }

  await prisma.appointment.update({
    where: { id: appointment.id },
    data: {
      status: AppointmentStatus.CANCELED,
      canceledAt: new Date(),
    },
  });

  await notifyMasterAboutCancellation(bot, appointment.id);

  return { ok: true as const, appointment };
}
