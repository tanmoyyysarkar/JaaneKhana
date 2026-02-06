import { GoogleGenerativeAI } from "@google/generative-ai";
import foodSchema from "../schemas/medical.schema.js";
import { fileToGenerativePart } from "../utils/generative.util.js";
import fs from "node:fs/promises";
import pkg from "wavefile";

const { WaveFile } = pkg;

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const LANGUAGE_NAMES = {
  en: "English",
  hi: "Hindi",
  bn: "Bengali",
  ta: "Tamil",
};

function normalizeLang(lang) {
  if (!lang || typeof lang !== "string") return "en";
  const code = lang.trim().toLowerCase();
  return LANGUAGE_NAMES[code] ? code : "en";
}

/**
 * STEP 1
 * Extract structured food ingredient data from image
 */
export async function extractPrescription(imagePath) {
  const model = genAI.getGenerativeModel({
    model: "gemini-2.5-flash-lite",
    systemInstruction: `
Extract structured food label data from the image.

Return ONLY valid JSON following the schema.
Use only visible information.
Do not guess or add explanations.
`,
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: foodSchema,
    },
  });

  const imagePart = await fileToGenerativePart(imagePath, "image/jpeg");

  const prompt = `
Analyze this food label image and extract:
1. Product name and brand
2. All ingredients listed - categorize each and assess health concern level
3. Allergens present
4. Key nutrition facts (calories, sugar, sodium, protein, fat)
5. Dietary flags (vegetarian, vegan, gluten-free, etc.)
6. Brief overall assessment

Use only information visible in the image.
`;

  const result = await model.generateContent([prompt, imagePart]);

  const rawText = result?.response?.text();
  if (!rawText) {
    throw new Error("Gemini returned empty response for extraction");
  }

  try {
    return JSON.parse(rawText);
  } catch (err) {
    console.error("Gemini invalid JSON:", rawText);
    throw new Error("Failed to parse Gemini JSON output");
  }
}

/**
 * STEP 2
 * Generate human-readable explanation from extracted food data
 */

export async function getDetailsFromData(foodJson, profileData, lang = "en", attempt = 1) {

  if (typeof lang === "number") {
    attempt = lang;
    lang = "en";
  }

  const langCode = normalizeLang(lang);
  const languageName = LANGUAGE_NAMES[langCode] || "English";

  /* ---------------- USER PROFILE BLOCK ---------------- */

  const profileBlock = profileData
    ? `
USER PROFILE:
Diet: ${profileData.diet || "unknown"}
Health Conditions: ${profileData.conditions?.join(", ") || "none"}
Allergies: ${profileData.allergies?.join(", ") || "none"}
Goal: ${profileData.goal || "general health"}
`
    : `USER PROFILE: Not provided`;

  /* ---------------- SYSTEM INSTRUCTION ---------------- */

  const model = genAI.getGenerativeModel({
    model: "gemini-2.5-flash",
    systemInstruction: `
You are JaaneKhana, an AI food copilot that explains food labels in a personalized way.

LANGUAGE:
Write the entire response in ${languageName} using native script.

WRITING STYLE:
- No greetings or introductions
- Use short bullet points
- Plain text only, no markdown or special characters
- Keep response concise (80-100 words total)
- Each point should be 1 sentence max

PERSONALIZATION RULES:
- Always tailor advice using the USER PROFILE
- If allergies match ingredients → clearly warn
- If health conditions conflict → strongly highlight risk
- If diet conflicts → mention suitability
- Relate final verdict to the user's goal
`,
    generationConfig: {
      responseMimeType: "text/plain",
    },
  });

  /* ---------------- MAIN PROMPT ---------------- */

  const prompt = `
${profileBlock}

FOOD LABEL DATA:
${JSON.stringify(foodJson, null, 2)}

Provide a brief analysis with these 4 points:

1. Product name and most concerning ingredients
2. Allergens (warn if matching user's allergies)
3. Impact on user's health conditions
4. Final verdict: eat regularly, occasionally, or avoid?

Keep each point to 1-2 sentences. Be direct.
`;

  try {
    const result = await model.generateContent(prompt);
    const text = result?.response?.text();
    if (!text) throw new Error("Empty explanation response");
    return text;
  } catch (error) {
    if (error?.status === 503 && attempt < 2) {
      await new Promise((r) => setTimeout(r, 2000));
      return getDetailsFromData(foodJson, profileData, lang, attempt + 1);
    }
    throw error;
  }
}

/**
 * MARKETING CLAIM DETECTOR
 * Detects misleading marketing claims on food packaging
 */
export async function detectMarketingClaims(imagePath) {
  const model = genAI.getGenerativeModel({
    model: "gemini-2.5-flash",
    systemInstruction: `
You are a food marketing claim fact-checker. Your job is to identify MISLEADING or FALSE marketing claims on food packaging. ONLY report claims that are problematic - skip accurate/truthful claims.

COMMON MISLEADING CLAIMS TO WATCH FOR:
- "No added sugar" → may contain natural sugars, maltitol, or artificial sweeteners
- "Natural" → may still contain processed ingredients
- "High protein" → may have excessive sugar/sodium
- "Immunity booster" → often unverified health claims
- "Low fat" → may be high in sugar to compensate
- "Sugar-free" → may contain sugar alcohols
- "Whole grain" → may be mostly refined flour
- "Light/Lite" → may only be slightly reduced
- "Made with real fruit" → may have minimal fruit content
- "Zero trans fat" → may have up to 0.5g per serving
- "Heart healthy" → may still be high in sodium
- "Organic" → doesn't mean healthy or low calorie

OUTPUT FORMAT (plain text, no markdown):
ONLY list misleading or false claims. Skip accurate claims entirely.

For each problematic claim, output:

CLAIM: [exact claim text]
REALITY: [what the ingredients/nutrition actually show]
VERDICT: [Misleading ⚠️ | False ✗]

If all claims are accurate OR no claims found, say: "No misleading claims detected. This product's marketing appears truthful."
`,
    generationConfig: {
      responseMimeType: "text/plain",
    },
  });

  const imagePart = await fileToGenerativePart(imagePath, "image/jpeg");

  const prompt = `
Analyze this food product image for MISLEADING or FALSE marketing claims only.

1. Identify all marketing claims visible on the packaging
2. Check each claim against actual ingredients and nutrition facts
3. ONLY report claims that are misleading or false - skip accurate ones

Focus on claims like:
- Health claims (immunity, energy, heart healthy)
- Nutrition claims (high protein, low fat, sugar-free, no added sugar)
- Quality claims (natural, organic, real ingredients, whole grain)
- Diet claims (keto, vegan, gluten-free)

Be specific about WHY a claim is misleading by referencing actual ingredients.
Do NOT include claims that are accurate/truthful.
`;

  const result = await model.generateContent([prompt, imagePart]);

  const text = result?.response?.text();
  if (!text) {
    throw new Error("Gemini returned empty response for marketing claims");
  }

  return text;
}

/**
 * Single API call - Analyze food label image directly
 * No need for separate OCR + explanation for printed food labels
 */
export async function analyzeFoodLabel(imagePath, profileData = null) {
  /* ---------------- USER PROFILE BLOCK ---------------- */
  const profileBlock = profileData
    ? `
USER PROFILE:
Diet: ${profileData.diet || "not specified"}
Health Conditions: ${profileData.conditions?.length ? profileData.conditions.join(", ") : "none specified"}
Allergies: ${profileData.allergies?.length ? profileData.allergies.join(", ") : "none specified"}
Goal: ${profileData.goal || "general health"}
`
    : "";

  const model = genAI.getGenerativeModel({
    model: "gemini-2.5-flash",
    systemInstruction: `
You are JaaneKhana, a concise food advisor. Give SHORT bullet points only.

RULES:
- Maximum 8-10 bullet points total
- Each point: 1 short sentence (max 15 words)
- Don't use any bullet
- NO paragraphs, NO introductions
- Plain text only, no markdown
- Be direct and actionable
${profileData ? "- Address user directly with 'you'" : ""}
`,
    generationConfig: {
      responseMimeType: "text/plain",
    },
  });

  const imagePart = await fileToGenerativePart(imagePath, "image/jpeg");

  const personalizedPrompt = profileData 
    ? `
${profileBlock}

Analyze this food label. Give exactly 8-10 SHORT bullet points:

• Product name + main concern
• Key ingredients to note
• Sugar/sodium content warning
• Allergen warning if matches user profile
• Impact on user's ${profileData.conditions?.length ? profileData.conditions[0] : 'health'}
• Protein/fiber content (good or bad)
• Additives or preservatives present
• Portion size recommendation
• Final verdict: eat regularly/occasionally/avoid
• One-line tip for user

Keep each bullet under 15 words. Be direct.
`
    : `
Analyze this food label. Give exactly 8-10 SHORT bullet points:

• Product name + main concern
• Key ingredients to note
• Sugar/sodium content warning
• Allergens present
• Who should avoid this
• Protein/fiber content (good or bad)
• Additives or preservatives present
• Portion size recommendation
• Final verdict
• One-line general tip

Keep each bullet under 15 words. Be direct.
`;

  const result = await model.generateContent([personalizedPrompt, imagePart]);

  const text = result?.response?.text();
  if (!text) {
    throw new Error("Gemini returned empty response");
  }

  return text;
}

/**
 * STEP 3
 * Convert explanation text to speech (WAV)
 */
export async function generateSpeechFromText(text, filename = "advice.wav") {
  const model = genAI.getGenerativeModel({
    model: "gemini-2.5-flash-preview-tts",
  });

  const voiceName = process.env.GEMINI_TTS_VOICE || "Kore";

  const prompt = `
Speak the following text in a friendly, helpful food advisor voice:

${text}
`;

  const result = await model.generateContent({
    contents: [
      {
        role: "user",
        parts: [{ text: prompt }],
      },
    ],
    generationConfig: {
      responseModalities: ["AUDIO"],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: {
            voiceName,
          },
        },
      },
    },
  });

  // The SDK response shape for AUDIO can vary; support common locations.
  const candidate = result?.response?.candidates?.[0];
  const parts = candidate?.content?.parts || [];
  const inlineDataPart = parts.find((p) => p?.inlineData?.data);
  const audioBase64 =
    inlineDataPart?.inlineData?.data ||
    result?.response?.audioData ||
    result?.response?.data;

  if (!audioBase64) {
    try {
      await fs.mkdir("./logs", { recursive: true });
      const dumpPath = `./logs/gemini_tts_no_audio_${Date.now()}.json`;
      await fs.writeFile(
        dumpPath,
        JSON.stringify(
          {
            model: "gemini-2.5-flash-preview-tts",
            voiceName,
            hasCandidates: Boolean(result?.response?.candidates?.length),
            firstCandidateKeys: candidate ? Object.keys(candidate) : null,
            firstPartsTypes: Array.isArray(parts) ? parts.map((p) => Object.keys(p || {})) : null,
            responseKeys: result?.response ? Object.keys(result.response) : null,
          },
          null,
          2
        ),
        "utf8"
      );
      console.warn("[GeminiTTS] No audio in response; wrote debug dump", { dumpPath });
    } catch {
      // ignore
    }
    throw new Error("No audio data returned from Gemini TTS");
  }

  // Gemini TTS outputs raw PCM (mono, 24kHz, 16-bit)
  const wav = new WaveFile();
  wav.fromScratch(
    1,        // channels
    24000,    // sample rate
    "16",     // bit depth
    Buffer.from(audioBase64, "base64")
  );

  await fs.mkdir("./uploads", { recursive: true });

  const filePath = `./uploads/${filename}`;
  await fs.writeFile(filePath, wav.toBuffer());

  return filePath;
}
