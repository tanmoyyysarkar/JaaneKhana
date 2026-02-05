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
  as: "Assamese",
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
You are JaaneKhana, an AI food ingredient analysis assistant.

TASK:
- Extract ALL ingredients and nutrition information visible on the food label image.
- Identify each ingredient and categorize it (natural, additive, preservative, sweetener, coloring, flavor, emulsifier, other).
- Assess concern level for each ingredient (safe, moderate, caution, avoid, unknown).
- Identify allergens present in the product.
- Extract key nutrition highlights if visible.
- Output MUST be valid JSON following the provided schema.
- Do NOT guess information not visible in the image.
- If a field is unclear or missing, set it to null.
- Do NOT include explanations, comments, or extra text outside JSON.
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
export async function getDetailsFromData(foodJson, lang = "en", attempt = 1) {
  // Back-compat: older calls passed (foodJson, attempt)
  if (typeof lang === "number") {
    attempt = lang;
    lang = "en";
  }

  const langCode = normalizeLang(lang);
  const languageName = LANGUAGE_NAMES[langCode] || "English";

  const model = genAI.getGenerativeModel({
    model: "gemini-2.5-flash",
    systemInstruction: `
You are JaaneKhana. Give CONCISE but DETAILED food ingredient analysis in PARAGRAPH format for smooth text-to-speech reading.

OUTPUT LANGUAGE:
- Write the entire response in ${languageName}.
- Use the native script for ${languageName} (do not transliterate to Latin/English letters).
- Do not mix languages.

RULES:
- NO introductions or greetings
- NO bullet points or dashes
- Write in flowing paragraphs
- Plain text only, no markdown or special characters
- Keep response around 150-200 words
- Be specific about health impacts
- Use natural sentence transitions
`,
    generationConfig: {
      responseMimeType: "text/plain",
    },
  });

  const prompt = `
Analyze this food product in PARAGRAPH format (no bullets) for TTS reading.
Write in ${languageName} only.

Paragraph 1: State the product name, then describe the main concerning ingredients and what they are.

Paragraph 2: List any allergens present in a sentence.

Paragraph 3: Explain how this product affects people with common health conditions - diabetes, high blood pressure, low blood pressure, thyroid issues, and high cholesterol. Be specific about whether each group should eat it, use caution, or avoid it.

Paragraph 4: Give a final verdict - who can safely enjoy this, who should limit it, and who should avoid it entirely.

Write naturally as if speaking to someone. No bullets, no dashes, just flowing sentences.

Data:
${JSON.stringify(foodJson, null, 2)}
`;

  try {
    const result = await model.generateContent(prompt);
    const text = result?.response?.text();
    if (!text) throw new Error("Empty explanation response");
    return text;
  } catch (error) {
    // Retry once on Google overload
    if (error?.status === 503 && attempt < 2) {
      await new Promise((r) => setTimeout(r, 2000));
      return getDetailsFromData(foodJson, attempt + 1);
    }
    throw error;
  }
}

/**
 * Single API call - Analyze food label image directly
 * No need for separate OCR + explanation for printed food labels
 */
export async function analyzeFoodLabel(imagePath) {
  const model = genAI.getGenerativeModel({
    model: "gemini-2.5-flash",
    systemInstruction: `
You are JaaneKhana, an AI food copilot that helps consumers understand food ingredients.

Analyze the food label image and provide a CONCISE but DETAILED analysis in PARAGRAPH format for smooth text-to-speech reading.

RULES:
- NO introductions or greetings
- NO bullet points or dashes
- Write in flowing paragraphs
- Plain text only, no markdown or special characters
- Keep response around 150-200 words
- Be specific about health impacts
- Use natural sentence transitions
`,
    generationConfig: {
      responseMimeType: "text/plain",
    },
  });

  const imagePart = await fileToGenerativePart(imagePath, "image/jpeg");

  const prompt = `
Look at this food label image and provide analysis in PARAGRAPH format (no bullets) for TTS reading:

Paragraph 1: State the product name, then describe the main concerning ingredients and what they are.

Paragraph 2: List any allergens present in a sentence.

Paragraph 3: Explain how this product affects people with common health conditions - diabetes, high blood pressure, low blood pressure, thyroid issues, and high cholesterol. Be specific about whether each group should eat it, use caution, or avoid it.

Paragraph 4: Give a final verdict - who can safely enjoy this, who should limit it, and who should avoid it entirely.

Write naturally as if speaking to someone. No bullets, no dashes, just flowing sentences.
`;

  const result = await model.generateContent([prompt, imagePart]);

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
