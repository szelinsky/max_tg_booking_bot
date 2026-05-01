import express from "express";
import { webhookCallback } from "grammy";

import { config } from "./config.js";
import { prisma } from "../lib/prisma.js";
import { createBot } from "../bot/index.js";

export function createServer() {
  const app = express();
  const bot = createBot();

  app.get("/health", async (_req, res) => {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ ok: true });
  });

  if (process.env.NODE_ENV === "production") {
    app.use(express.json());
    app.use("/webhook", webhookCallback(bot, "express"));
  } else {
    void bot.start();
  }

  return app;
}

export function startServer() {
  const app = createServer();

  app.listen(config.port, () => {
    console.log(`Server listening on http://localhost:${config.port}`);
  });
}
