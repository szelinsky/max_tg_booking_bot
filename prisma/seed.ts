import "dotenv/config";

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const master = await prisma.master.upsert({
    where: { id: 1 },
    update: {
      name: "Макс",
    },
    create: {
      id: 1,
      name: "Макс",
    },
  });

  await prisma.service.upsert({
    where: { id: 1 },
    update: {
      name: "Мужская стрижка",
      durationMinutes: 60,
      price: "25",
      masterId: master.id,
      isActive: true,
    },
    create: {
      id: 1,
      name: "Мужская стрижка",
      durationMinutes: 60,
      price: "25",
      masterId: master.id,
    },
  });

  await prisma.service.upsert({
    where: { id: 2 },
    update: {
      name: "Стрижка бороды",
      durationMinutes: 30,
      price: "15",
      masterId: master.id,
      isActive: true,
    },
    create: {
      id: 2,
      name: "Стрижка бороды",
      durationMinutes: 30,
      price: "15",
      masterId: master.id,
    },
  });

  for (const weekday of [1, 2, 3, 4, 5, 6]) {
    await prisma.workingHour.upsert({
      where: {
        masterId_weekday: {
          masterId: master.id,
          weekday,
        },
      },
      update: {
        startTime: "10:00",
        endTime: "19:00",
        isActive: true,
      },
      create: {
        masterId: master.id,
        weekday,
        startTime: "10:00",
        endTime: "19:00",
      },
    });
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
