const botToken = process.env.BOT_TOKEN;

if (!botToken) {
  throw new Error("BOT_TOKEN is not set");
}

export const config = {
  botToken,
  port: Number(process.env.PORT ?? 3000),
  botTimeZone: process.env.BOT_TIMEZONE ?? "America/Los_Angeles",
} as const;
