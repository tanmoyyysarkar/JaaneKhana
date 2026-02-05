import { Telegraf } from "telegraf";
import setupWebhook from "./webhook.js";
import registerPhotoHandler from "./handlers/photo.handler.js";
import { registerLanguageHandler } from "./handlers/language.handler.js";

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);

setupWebhook(bot);
registerLanguageHandler(bot);
registerPhotoHandler(bot);

export default bot;
