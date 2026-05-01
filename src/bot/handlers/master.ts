import type { Bot } from "grammy";

import { CALLBACK } from "../callback-data.js";
import type { AppContext } from "../context.js";
import {
  bindMasterToCurrentChat,
  openMasterPanel,
} from "../flows.js";

export function registerMasterHandlers(bot: Bot<AppContext>) {
  bot.command("master", async (ctx) => {
    const text = ctx.message?.text ?? "";
    const [, rawMasterId] = text.trim().split(/\s+/, 2);

    if (rawMasterId) {
      const masterId = Number(rawMasterId);

      if (!Number.isInteger(masterId) || masterId <= 0) {
        await ctx.reply("Укажите корректный ID мастера. Пример: /master 1");
        return;
      }

      await bindMasterToCurrentChat(ctx, masterId);
      return;
    }

    await openMasterPanel(ctx);
  });

  bot.callbackQuery(CALLBACK.masterAppointments, async (ctx) => {
    await ctx.answerCallbackQuery();
    await openMasterPanel(ctx);
  });
}
