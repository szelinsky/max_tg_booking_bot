import type { Context } from "grammy";

import { prisma } from "../lib/prisma.js";

export async function ensureUser(ctx: Context) {
  if (!ctx.from) {
    throw new Error("Telegram user info is missing");
  }

  return prisma.user.upsert({
    where: { telegramId: BigInt(ctx.from.id) },
    create: {
      telegramId: BigInt(ctx.from.id),
      username: ctx.from.username,
      firstName: ctx.from.first_name,
    },
    update: {
      username: ctx.from.username,
      firstName: ctx.from.first_name,
    },
  });
}
