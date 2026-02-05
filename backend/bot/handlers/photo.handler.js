import { message } from "telegraf/filters";
import path from "node:path";
import fs from "node:fs";
import {
  downloadTelegramFile,
  deleteFile,
} from "../../services/file.service.js";
import {
  extractPrescription,
  getDetailsFromData,
} from "../../services/gemini.service.js";
import { elevenLabsTTS } from "../../services/eleven.service.js";
import {
  ensureLanguageSelected,
  getUserLanguage,
} from "./language.handler.js";

/**
 * Registers photo handler for the bot
 */
const registerPhotoHandler = (bot) => {
  bot.on(message("photo"), async (ctx) => {
    // 1. Ensure language is selected
    const ok = await ensureLanguageSelected(ctx);
    if (!ok) return;

    // 2. Prevent concurrent processing per user
    if (ctx.session?.isProcessing) {
      return ctx.reply(
        "⏳ I'm still processing your previous image. Please wait a moment."
      );
    }

    // 3. Process in background (Telegram webhook safety)
    processPrescription(ctx).catch((err) => {
      console.error("Background Processing Error:", err);
    });
  });
};

/**
 * Handles full prescription processing pipeline
 */
async function processPrescription(ctx) {
  if (!ctx.session) ctx.session = {};
  ctx.session.isProcessing = true;

  const lang = getUserLanguage(ctx);
  const photo = ctx.message.photo.at(-1);

  const uploadsDir = path.resolve(process.cwd(), "uploads");
  const imagePath = path.join(uploadsDir, `${photo.file_id}.jpg`);
  let audioPath = null;

  try {
    await ctx.reply(`🔍 Analyzing prescription (${lang.toUpperCase()})...`);

    // Ensure uploads directory exists
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    // 1. Download image from Telegram
    await downloadTelegramFile(ctx, photo.file_id, imagePath);

    // 2. Extract structured data (OCR + JSON)
    const prescriptionData = await extractPrescription(imagePath);

    // 3. Generate medical explanation (text)
    const medicalAdvice = await getDetailsFromData(prescriptionData);

    // 4. Send text response
    await ctx.reply(
      `📋 *Medical Analysis:*\n\n${medicalAdvice}`,
      { parse_mode: "Markdown" }
    );

    // 5. Generate voice using ElevenLabs (stable)
    await ctx.sendChatAction("record_voice");
    audioPath = await elevenLabsTTS(medicalAdvice);

    // 6. Send audio
    await ctx.replyWithAudio(
      { source: audioPath },
      {
        title: "MedEase Audio Advice",
        caption: "🔊 Listen to your prescription summary",
      }
    );
  } catch (err) {
    console.error("Handler Error:", err);
    await ctx.reply(
      "❌ Sorry, I couldn't process that image. Please make sure it's a clear photo of a prescription."
    );
  } finally {
    // Release lock
    ctx.session.isProcessing = false;

    // Cleanup files safely
    if (fs.existsSync(imagePath)) {
      await deleteFile(imagePath);
    }
    if (audioPath && fs.existsSync(audioPath)) {
      fs.unlinkSync(audioPath);
    }
  }
}

export default registerPhotoHandler;
