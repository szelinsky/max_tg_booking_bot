import { Bot } from "grammy";

import { config } from "../app/config.js";
import type { AppContext } from "./context.js";
import { registerBookingHandlers } from "./handlers/booking.js";
import { registerMasterHandlers } from "./handlers/master.js";

export function createBot() {
  const bot = new Bot<AppContext>(config.botToken);

  registerBookingHandlers(bot);
  registerMasterHandlers(bot);

  bot.catch((error) => {
    console.error("Bot error", error.error);
  });

  return bot;
}
