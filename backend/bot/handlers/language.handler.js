import { startProfileWizard } from "./profile.handler.js";
// bot/handlers/language.handler.js

const LANGUAGES = {
    en: "English",
    hi: "हिन्दी",
    bn: "বাংলা",
    ta: "தமிழ்",
};

// Translations for language handler messages
const LANG_TRANSLATIONS = {
    en: {
        languageSet: "Language set to: English\n\nLet's set up your health profile.",
    },
    hi: {
        languageSet: "भाषा चुनी गई: हिन्दी\n\nआइए आपकी स्वास्थ्य प्रोफ़ाइल बनाएं।",
    },
    bn: {
        languageSet: "ভাষা নির্বাচিত: বাংলা\n\nআসুন আপনার স্বাস্থ্য প্রোফাইল তৈরি করি।",
    },
    ta: {
        languageSet: "மொழி தேர்ந்தெடுக்கப்பட்டது: தமிழ்\n\nஉங்கள் சுகாதார சுயவிவரத்தை அமைப்போம்.",
    },
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
    bot.action(/^lang_/, async (ctx) => {
        const data = ctx.callbackQuery.data;
        const langCode = data.replace("lang_", "");
        const userId = ctx.from.id;

        if (!LANGUAGES[langCode]) {
            await ctx.answerCbQuery("Invalid language");
            return;
        }

        userLanguageMap.set(userId, langCode);

        await ctx.answerCbQuery();
        await ctx.editMessageText(
            LANG_TRANSLATIONS[langCode]?.languageSet || LANG_TRANSLATIONS.en.languageSet
        );

        await startProfileWizard(ctx, langCode);
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
