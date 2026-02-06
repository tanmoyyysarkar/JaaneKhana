// bot/handlers/profile.handler.js

/* ------------------------------------------------ */
/* In-memory user profile store (hackathon version) */
/* ------------------------------------------------ */

const userProfileMap = new Map();

export function saveUserProfile(userId, profile) {
    userProfileMap.set(userId, profile);
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

async function askDiet(ctx) {
    await ctx.reply("Select your diet:", {
        reply_markup: {
            inline_keyboard: [
                [{ text: "Vegetarian", callback_data: "diet_vegetarian" }],
                [{ text: "Vegan", callback_data: "diet_vegan" }],
                [{ text: "Non-Vegetarian", callback_data: "diet_nonveg" }],
            ],
        },
    });
}

async function askConditions(ctx) {
    const selected = ctx.session.tempProfile.conditions || [];

    const options = [
        { label: "Diabetes", value: "diabetes" },
        { label: "High BP", value: "bp" },
        { label: "Thyroid", value: "thyroid" },
        { label: "Cholesterol", value: "cholesterol" },
    ];

    await ctx.editMessageText(
        "Select health conditions:",
        {
            reply_markup: {
                inline_keyboard: buildMultiSelectKeyboard(
                    options,
                    selected,
                    "cond_",
                    "DONE ✅"
                ),
            },
        }
    );
}



async function askAllergies(ctx) {
    const selected = ctx.session.tempProfile.allergies || [];

    const options = [
        { label: "Milk/Lactose", value: "milk" },
        { label: "Nuts", value: "nuts" },
        { label: "Gluten", value: "gluten" },
        { label: "Soy", value: "soy" },
    ];

    await ctx.editMessageText(
        "Select food allergies:",
        {
            reply_markup: {
                inline_keyboard: buildMultiSelectKeyboard(
                    options,
                    selected,
                    "allergy_",
                    "DONE ✅"
                ),
            },
        }
    );
}

async function askGoal(ctx) {
    await ctx.editMessageText("What is your goal?", {
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

export async function startProfileWizard(ctx) {
    if (!ctx.session) ctx.session = {}
    ctx.session.profileStep = "diet";
    ctx.session.tempProfile = {
        conditions: [],
        allergies: [],
    };
    await askDiet(ctx);
}


/* ------------------------------------------------ */
/* Register profile handler                         */
/* ------------------------------------------------ */

const registerProfileHandler = (bot) => {

    // manual command to edit profile later
    bot.command("profile", async (ctx) => {
        await startProfileWizard(ctx);
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

        /* ---- STEP 1: DIET ---- */
        if (step === "diet" && data.startsWith("diet_")) {
            ctx.session.tempProfile.diet = data.replace("diet_", "");
            ctx.session.profileStep = "conditions";
            return askConditions(ctx);
        }

        /* ---- STEP 2: CONDITIONS ---- */
        if (step === "conditions" && data.startsWith("cond_")) {

            if (data === "cond_done") {
                ctx.session.profileStep = "allergies";
                return askAllergies(ctx);
            }

            const value = data.replace("cond_", "");
            const arr = ctx.session.tempProfile.conditions;

            const index = arr.indexOf(value);
            if (index > -1) arr.splice(index, 1);
            else arr.push(value);

            return askConditions(ctx);
        }



        /* ---- STEP 3: ALLERGIES ---- */
        if (step === "allergies" && data.startsWith("allergy_")) {

            if (data === "allergy_done") {
                ctx.session.profileStep = "goal";
                return askGoal(ctx);
            }

            const value = data.replace("allergy_", "");
            const arr = ctx.session.tempProfile.allergies;

            const index = arr.indexOf(value);
            if (index > -1) arr.splice(index, 1);
            else arr.push(value);

            return askAllergies(ctx);
        }


        /* ---- STEP 4: GOAL ---- */
        if (step === "goal" && data.startsWith("goal_")) {
            ctx.session.tempProfile.goal = data.replace("goal_", "");

            saveUserProfile(ctx.from.id, ctx.session.tempProfile);

            ctx.session.profileStep = null;
            ctx.session.tempProfile = null;

            return ctx.editMessageText(
                "Profile saved. You can now send food label images."
            );
        }
    });
};


export default registerProfileHandler;
