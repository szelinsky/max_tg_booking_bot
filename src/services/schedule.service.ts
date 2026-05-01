import { AppointmentStatus } from "@prisma/client";

import { SLOT_STEP_MINUTES } from "../app/constants.js";
import { prisma } from "../lib/prisma.js";
import type { Slot } from "../types/booking.js";
import {
  addDaysToDateKey,
  addMinutes,
  buildSlotDate,
  getWeekday,
  intersects,
  startOfDayUtc,
  toDateKey,
} from "../utils/datetime.js";
import { getServiceById } from "./catalog.service.js";

export async function getAvailableSlots(serviceId: number, dateKey: string): Promise<Slot[]> {
  const service = await getServiceById(serviceId);

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
  const windowStart = buildSlotDate(dateKey, workingHour.startTime);
  const windowEnd = buildSlotDate(dateKey, workingHour.endTime);

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

export async function getAvailableDateKeys(serviceId: number, daysToShow: number) {
  const todayDateKey = toDateKey(new Date());
  const availableDateKeys: string[] = [];

  for (let offset = 0; offset < daysToShow; offset += 1) {
    const dateKey = addDaysToDateKey(todayDateKey, offset);
    const slots = await getAvailableSlots(serviceId, dateKey);

    if (slots.length > 0) {
      availableDateKeys.push(dateKey);
    }
  }

  return availableDateKeys;
}
