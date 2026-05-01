import type { Bot } from "grammy";

import { CALLBACK } from "../callback-data.js";
import type { AppContext } from "../context.js";
import {
  cancelAppointmentFlow,
  confirmAppointmentFlow,
  renderDatesMenu,
  renderMyAppointments,
  renderServicesMenu,
  renderSlotsMenu,
} from "../flows.js";
import { getAppointmentCanceledText } from "../messages/appointments.js";
import { ensureUser } from "../../services/user.service.js";

export function registerBookingHandlers(bot: Bot<AppContext>) {
  bot.command("start", async (ctx) => {
    await ensureUser(ctx);
    await renderServicesMenu(ctx, "Добро пожаловать. Выберите услугу:");
  });

  bot.command("my_appointments", async (ctx) => {
    await renderMyAppointments(ctx);
  });

  bot.callbackQuery(CALLBACK.myAppointments, async (ctx) => {
    await ctx.answerCallbackQuery();
    await renderMyAppointments(ctx);
  });

  bot.callbackQuery(CALLBACK.backServices, async (ctx) => {
    await ctx.answerCallbackQuery();
    await renderServicesMenu(ctx);
  });

  bot.callbackQuery(new RegExp(`^${CALLBACK.service}:(\\d+)$`), async (ctx) => {
    const serviceId = Number(ctx.match?.[1]);
    await ctx.answerCallbackQuery();
    await renderDatesMenu(ctx, serviceId);
  });

  bot.callbackQuery(new RegExp(`^${CALLBACK.date}:(\\d+):(\\d{4}-\\d{2}-\\d{2})$`), async (ctx) => {
    const serviceId = Number(ctx.match?.[1]);
    const dateKey = String(ctx.match?.[2]);
    await ctx.answerCallbackQuery();
    await renderSlotsMenu(ctx, serviceId, dateKey);
  });

  bot.callbackQuery(new RegExp(`^${CALLBACK.confirm}:(\\d+):(.+)$`), async (ctx) => {
    const serviceId = Number(ctx.match?.[1]);
    const startsAtIso = String(ctx.match?.[2]);
    await ctx.answerCallbackQuery();
    await confirmAppointmentFlow(ctx, bot, serviceId, startsAtIso);
  });

  bot.callbackQuery(new RegExp(`^${CALLBACK.cancel}:(\\d+)$`), async (ctx) => {
    const appointmentId = Number(ctx.match?.[1]);
    const result = await cancelAppointmentFlow(ctx, bot, appointmentId);

    if (!result.ok) {
      await ctx.answerCallbackQuery({ text: "Запись не найдена или уже отменена." });
      return;
    }

    await ctx.answerCallbackQuery({ text: "Запись отменена" });
    await ctx.reply(getAppointmentCanceledText(result.appointment));
  });
}
