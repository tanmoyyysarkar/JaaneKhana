import { GoogleGenerativeAI } from "@google/generative-ai";
import medicalSchema from "../schemas/medical.schema.js";
import { fileToGenerativePart } from "../utils/generative.util.js";
import fs from "node:fs/promises";
import pkg from "wavefile";

const { WaveFile } = pkg;

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

/**
 * STEP 1
 * Extract structured prescription data from image
 */
export async function extractPrescription(imagePath) {
  const model = genAI.getGenerativeModel({
    model: "gemini-2.5-flash-lite",
    systemInstruction: `
You are MedEase, a medical prescription OCR assistant.

TASK:
- Extract ONLY what is visible in the prescription image.
- Output MUST be valid JSON.
- JSON MUST strictly follow the provided schema.
- Do NOT guess or infer missing information.
- If a field is unclear or missing, set it to null.
- Do NOT include explanations, comments, or extra text.
`,
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: medicalSchema,
    },
  });

  const imagePart = await fileToGenerativePart(imagePath, "image/jpeg");

  const prompt = `
Extract all readable information from this prescription image.
Use only the text present in the image.
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
 * Generate human-readable explanation from extracted JSON
 */
export async function getDetailsFromData(prescriptionJson, attempt = 1) {
  const model = genAI.getGenerativeModel({
    model: "gemini-2.5-flash",
    systemInstruction: `
You are a medical assistant explaining prescriptions to patients.

RULES:
- Do NOT diagnose diseases.
- Do NOT suggest new medicines.
- Do NOT modify prescription data.
- Use simple, patient-friendly language.
- Do NOT use Markdown formatting.
- Use plain text only.
- Use "-" for lists.
- Keep tone professional and calm.
`,
    generationConfig: {
      responseMimeType: "text/plain",
    },
  });

  const prompt = `
Explain the following prescription clearly for a patient.

Prescription data (JSON):
${JSON.stringify(prescriptionJson, null, 2)}
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
      return getDetailsFromData(prescriptionJson, attempt + 1);
    }
    throw error;
  }
}

/**
 * STEP 3
 * Convert explanation text to speech (WAV)
 */
export async function generateSpeechFromText(text, filename = "advice.wav") {
  const model = genAI.getGenerativeModel({
    model: "gemini-2.5-flash-preview-tts",
  });

  const prompt = `
Speak the following text in a calm, professional medical assistant voice:

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
            voiceName: "Kore",
          },
        },
      },
    },
  });

  const audioBase64 =
    result?.response?.audioData || result?.response?.data;

  if (!audioBase64) {
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
