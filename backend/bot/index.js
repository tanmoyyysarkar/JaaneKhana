import { Telegraf, session } from "telegraf";
import setupWebhook from "./webhook.js";
import registerPhotoHandler from "./handlers/photo.handler.js";
import { registerLanguageHandler } from "./handlers/language.handler.js";
import registerProfileHandler from "./handlers/profile.handler.js";

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);

setupWebhook(bot);

bot.use(session({
    getSessionKey: (ctx) =>{
        return ctx.from ? String(ctx.from.id) : null;
    }
}))

registerLanguageHandler(bot);
registerProfileHandler(bot);
registerPhotoHandler(bot);

export default bot;
