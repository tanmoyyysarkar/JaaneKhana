// bot/handlers/profile.handler.js

/* ------------------------------------------------ */
/* In-memory user profile store (hackathon version) */
/* ------------------------------------------------ */

const userProfileMap = new Map();

// Translations for profile wizard (option labels stay in English)
const PROFILE_TRANSLATIONS = {
    en: {
        selectDiet: "Select your diet:",
        selectConditions: "Select health conditions:",
        selectAllergies: "Select food allergies:",
        selectGoal: "What is your goal?",
        profileSaved: "✅ Profile saved! You can now send food label images.",
        done: "DONE ✅",
    },
    hi: {
        selectDiet: "अपना आहार चुनें:",
        selectConditions: "स्वास्थ्य समस्याएं चुनें:",
        selectAllergies: "खाद्य एलर्जी चुनें:",
        selectGoal: "आपका लक्ष्य क्या है?",
        profileSaved: "✅ प्रोफ़ाइल सहेजी गई! अब आप फ़ूड लेबल की फ़ोटो भेज सकते हैं।",
        done: "पूर्ण ✅",
    },
    bn: {
        selectDiet: "আপনার খাদ্যাভ্যাস নির্বাচন করুন:",
        selectConditions: "স্বাস্থ্য সমস্যা নির্বাচন করুন:",
        selectAllergies: "খাদ্য এলার্জি নির্বাচন করুন:",
        selectGoal: "আপনার লক্ষ্য কী?",
        profileSaved: "✅ প্রোফাইল সংরক্ষিত! এখন আপনি খাদ্য লেবেলের ছবি পাঠাতে পারেন।",
        done: "সম্পন্ন ✅",
    },
    ta: {
        selectDiet: "உங்கள் உணவு முறையை தேர்ந்தெடுக்கவும்:",
        selectConditions: "சுகாதார நிலைகளை தேர்ந்தெடுக்கவும்:",
        selectAllergies: "உணவு ஒவ்வாமைகளை தேர்ந்தெடுக்கவும்:",
        selectGoal: "உங்கள் இலக்கு என்ன?",
        profileSaved: "✅ சுயவிவரம் சேமிக்கப்பட்டது! இப்போது உணவு லேபிள் படங்களை அனுப்பலாம்.",
        done: "முடிந்தது ✅",
    },
};

// Helper to get translation
const pt = (lang, key) => PROFILE_TRANSLATIONS[lang]?.[key] || PROFILE_TRANSLATIONS.en[key];

export function saveUserProfile(userId, profile) {
    userProfileMap.set(userId, profile);
    console.log(profile);
}

export function getUserProfile(userId) {
    return userProfileMap.get(userId) || null;
}

export function hasUserProfile(userId) {
    return userProfileMap.has(userId);
}


/* ------------------------------------------------ */
/* Inline keyboard builders                         */
/* ------------------------------------------------ */

async function askDiet(ctx, lang = "en") {
    await ctx.reply(pt(lang, "selectDiet"), {
        reply_markup: {
            inline_keyboard: [
                [{ text: "Vegetarian", callback_data: "diet_vegetarian" }],
                [{ text: "Vegan", callback_data: "diet_vegan" }],
                [{ text: "Non-Vegetarian", callback_data: "diet_nonveg" }],
            ],
        },
    });
}

async function askConditions(ctx, lang = "en") {
    const selected = ctx.session.tempProfile.conditions || [];

    const options = [
        { label: "Diabetes", value: "diabetes" },
        { label: "High BP", value: "bp" },
        { label: "Thyroid", value: "thyroid" },
        { label: "Cholesterol", value: "cholesterol" },
    ];

    await ctx.editMessageText(
        pt(lang, "selectConditions"),
        {
            reply_markup: {
                inline_keyboard: buildMultiSelectKeyboard(
                    options,
                    selected,
                    "cond_",
                    pt(lang, "done")
                ),
            },
        }
    );
}



async function askAllergies(ctx, lang = "en") {
    const selected = ctx.session.tempProfile.allergies || [];

    const options = [
        { label: "Milk/Lactose", value: "milk" },
        { label: "Nuts", value: "nuts" },
        { label: "Gluten", value: "gluten" },
        { label: "Soy", value: "soy" },
    ];

    await ctx.editMessageText(
        pt(lang, "selectAllergies"),
        {
            reply_markup: {
                inline_keyboard: buildMultiSelectKeyboard(
                    options,
                    selected,
                    "allergy_",
                    pt(lang, "done")
                ),
            },
        }
    );
}

async function askGoal(ctx, lang = "en") {
    await ctx.editMessageText(pt(lang, "selectGoal"), {
        reply_markup: {
            inline_keyboard: [
                [{ text: "Healthy eating", callback_data: "goal_health" }],
                [{ text: "Weight loss", callback_data: "goal_weightloss" }],
                [{ text: "Muscle gain", callback_data: "goal_musclegain" }],
            ],
        },
    });
}

function buildMultiSelectKeyboard(options, selected, prefix, doneLabel) {
    return options.map(opt => [{
        text: `${selected.includes(opt.value) ? "✅ " : ""}${opt.label}`,
        callback_data: `${prefix}${opt.value}`
    }]).concat([[{ text: doneLabel, callback_data: `${prefix}done` }]]);
}

/* ------------------------------------------------ */
/* Wizard launcher (called after language selection)*/
/* ------------------------------------------------ */

export async function startProfileWizard(ctx, lang = "en") {
    if (!ctx.session) ctx.session = {}
    ctx.session.profileStep = "diet";
    ctx.session.profileLang = lang; // Store language for wizard
    ctx.session.tempProfile = {
        conditions: [],
        allergies: [],
    };
    await askDiet(ctx, lang);
}


/* ------------------------------------------------ */
/* Register profile handler                         */
/* ------------------------------------------------ */

const registerProfileHandler = (bot) => {

    // manual command to edit profile later
    bot.command("profile", async (ctx) => {
        const lang = ctx.session?.profileLang || "en";
        await startProfileWizard(ctx, lang);
    });

    // handle ONLY wizard buttons
    bot.action(/^(diet_|cond_|allergy_|goal_)/, async (ctx) => {
        const data = ctx.callbackQuery.data;

        // wizard not active → ignore click
        if (!ctx.session?.profileStep) {
            await ctx.answerCbQuery();
            return;
        }

        await ctx.answerCbQuery();

        const step = ctx.session.profileStep;
        const lang = ctx.session.profileLang || "en";

        /* ---- STEP 1: DIET ---- */
        if (step === "diet" && data.startsWith("diet_")) {
            ctx.session.tempProfile.diet = data.replace("diet_", "");
            ctx.session.profileStep = "conditions";
            return askConditions(ctx, lang);
        }

        /* ---- STEP 2: CONDITIONS ---- */
        if (step === "conditions" && data.startsWith("cond_")) {

            if (data === "cond_done") {
                ctx.session.profileStep = "allergies";
                return askAllergies(ctx, lang);
            }

            const value = data.replace("cond_", "");
            const arr = ctx.session.tempProfile.conditions;

            const index = arr.indexOf(value);
            if (index > -1) arr.splice(index, 1);
            else arr.push(value);

            return askConditions(ctx, lang);
        }



        /* ---- STEP 3: ALLERGIES ---- */
        if (step === "allergies" && data.startsWith("allergy_")) {

            if (data === "allergy_done") {
                ctx.session.profileStep = "goal";
                return askGoal(ctx, lang);
            }

            const value = data.replace("allergy_", "");
            const arr = ctx.session.tempProfile.allergies;

            const index = arr.indexOf(value);
            if (index > -1) arr.splice(index, 1);
            else arr.push(value);

            return askAllergies(ctx, lang);
        }


        /* ---- STEP 4: GOAL ---- */
        if (step === "goal" && data.startsWith("goal_")) {
            ctx.session.tempProfile.goal = data.replace("goal_", "");

            saveUserProfile(ctx.from.id, ctx.session.tempProfile);

            ctx.session.profileStep = null;
            ctx.session.tempProfile = null;

            return ctx.editMessageText(pt(lang, "profileSaved"));
        }
    });
};


export default registerProfileHandler;
