import { prisma } from "../lib/prisma.js";

export function getServiceById(serviceId: number) {
  return prisma.service.findUnique({
    where: { id: serviceId },
    include: { master: true },
  });
}

export function getActiveServices() {
  return prisma.service.findMany({
    where: { isActive: true },
    include: { master: true },
    orderBy: [{ master: { name: "asc" } }, { name: "asc" }],
  });
}
