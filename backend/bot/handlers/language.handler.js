// bot/handlers/language.handler.js

const LANGUAGES = {
    en: "English",
    hi: "हिन्दी",
    bn: "বাংলা",
    as: "অসমীয়া",
    ta: "தமிழ்",
};

const DEFAULT_LANG = "en";

/**
 * In-memory store for hackathon
 * key: Telegram user id
 * value: language code
 */
const userLanguageMap = new Map();

/**
 * Sends language selection buttons
 */
const sendLanguageKeyboard = async (ctx) => {
    return ctx.reply("Please select your preferred language:", {
        reply_markup: {
            inline_keyboard: Object.entries(LANGUAGES).map(([code, label]) => [
                { text: label, callback_data: `lang_${code}` },
            ]),
        },
    });
}

/**
 * Register language-related handlers on the bot
 */
const registerLanguageHandler = (bot) => {
    // /start command → language selection
    bot.start(async (ctx) => {
        await sendLanguageKeyboard(ctx);
    });

    // Handle inline keyboard selection
    bot.on("callback_query", async (ctx) => {
        const data = ctx.callbackQuery?.data;
        if (!data || !data.startsWith("lang_")) return;

        const langCode = data.replace("lang_", "");
        const userId = ctx.from.id;

        if (!LANGUAGES[langCode]) {
            await ctx.answerCbQuery("Invalid language");
            return;
        }

        userLanguageMap.set(userId, langCode);

        await ctx.answerCbQuery();
        await ctx.editMessageText(
            `Language set to: ${LANGUAGES[langCode]}\n\nSend a prescription image to continue.`
        );
    });
}

/**
 * Get user's preferred language
 */
const getUserLanguage = (ctx) => {
    return userLanguageMap.get(ctx.from.id) || DEFAULT_LANG;
}

/**
 * Guard to ensure language is selected before continuing
 * Returns true if language exists, false otherwise
 */
const ensureLanguageSelected = async (ctx) => {
    if (!userLanguageMap.has(ctx.from.id)) {
        await sendLanguageKeyboard(ctx);
        return false;
    }
    return true;
}

export {
    registerLanguageHandler,
    getUserLanguage,
    ensureLanguageSelected,
    LANGUAGES,
};
