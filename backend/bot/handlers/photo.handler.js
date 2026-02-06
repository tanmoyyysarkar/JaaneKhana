import { message } from "telegraf/filters";
import { Markup } from "telegraf";
import path from "node:path";
import fs from "node:fs";
import {
  downloadTelegramFile,
  deleteFile,
} from "../../services/file.service.js";
import {
  extractPrescription,
  getDetailsFromData,
  detectMarketingClaims,
} from "../../services/gemini.service.js";
import { generateTTS } from "../../services/tts.service.js";
import {
  ensureLanguageSelected,
  getUserLanguage,
} from "./language.handler.js";
import { hasUserProfile, getUserProfile } from "./profile.handler.js";

// Store pending photos waiting for user action
const pendingPhotos = new Map();

// Translations for bot messages
const TRANSLATIONS = {
  en: {
    photoReceived: "📷 Photo received! What would you like me to do?",
    analyzeLabel: "🔍 Analyze Label",
    checkClaims: "🎯 Check Claims",
    selectedAnalyze: "📷 Photo received! You selected: 🔍 Analyze Label",
    selectedClaims: "📷 Photo received! You selected: 🎯 Check Claims",
    analyzing: "🔍 Analyzing food label...",
    checkingClaims: "🎯 Checking marketing claims...",
    analysisTitle: "📋 *Food Analysis:*",
    claimsTitle: "🎯 *Marketing Claims Check:*",
    audioCaption: "🔊 Listen to your food analysis",
    noPhoto: "❌ No photo found. Please send a new photo.",
    profileFirst: "Please complete your profile first using /start",
    processing: "⏳ I'm still processing your previous image. Please wait.",
    errorAnalysis: "❌ Sorry, I couldn't analyze that image. Please send a clear photo of a food label.",
    errorClaims: "❌ Sorry, I couldn't check claims. Please send a clear photo.",
  },
  hi: {
    photoReceived: "📷 फ़ोटो मिल गई! आप क्या करना चाहेंगे?",
    analyzeLabel: "🔍 लेबल विश्लेषण",
    checkClaims: "🎯 दावे जांचें",
    selectedAnalyze: "📷 फ़ोटो मिली! आपने चुना: 🔍 लेबल विश्लेषण",
    selectedClaims: "📷 फ़ोटो मिली! आपने चुना: 🎯 दावे जांचें",
    analyzing: "🔍 फ़ूड लेबल का विश्लेषण हो रहा है...",
    checkingClaims: "🎯 मार्केटिंग दावों की जांच हो रही है...",
    analysisTitle: "📋 *खाद्य विश्लेषण:*",
    claimsTitle: "🎯 *मार्केटिंग दावों की जांच:*",
    audioCaption: "🔊 अपना खाद्य विश्लेषण सुनें",
    noPhoto: "❌ कोई फ़ोटो नहीं मिली। कृपया नई फ़ोटो भेजें।",
    profileFirst: "कृपया पहले /start से अपनी प्रोफ़ाइल बनाएं",
    processing: "⏳ मैं अभी पिछली इमेज प्रोसेस कर रहा हूं। कृपया रुकें।",
    errorAnalysis: "❌ माफ़ करें, इमेज का विश्लेषण नहीं हो सका। कृपया फ़ूड लेबल की साफ़ फ़ोटो भेजें।",
    errorClaims: "❌ माफ़ करें, दावों की जांच नहीं हो सकी। कृपया साफ़ फ़ोटो भेजें।",
  },
  bn: {
    photoReceived: "📷 ছবি পেয়েছি! আপনি কী করতে চান?",
    analyzeLabel: "🔍 লেবেল বিশ্লেষণ",
    checkClaims: "🎯 দাবি যাচাই",
    selectedAnalyze: "📷 ছবি পেয়েছি! আপনি বেছে নিলেন: 🔍 লেবেল বিশ্লেষণ",
    selectedClaims: "📷 ছবি পেয়েছি! আপনি বেছে নিলেন: 🎯 দাবি যাচাই",
    analyzing: "🔍 খাদ্য লেবেল বিশ্লেষণ করা হচ্ছে...",
    checkingClaims: "🎯 মার্কেটিং দাবি যাচাই করা হচ্ছে...",
    analysisTitle: "📋 *খাদ্য বিশ্লেষণ:*",
    claimsTitle: "🎯 *মার্কেটিং দাবি যাচাই:*",
    audioCaption: "🔊 আপনার খাদ্য বিশ্লেষণ শুনুন",
    noPhoto: "❌ কোনো ছবি পাওয়া যায়নি। অনুগ্রহ করে নতুন ছবি পাঠান।",
    profileFirst: "অনুগ্রহ করে প্রথমে /start দিয়ে প্রোফাইল তৈরি করুন",
    processing: "⏳ আমি এখনও আগের ছবি প্রসেস করছি। অনুগ্রহ করে অপেক্ষা করুন।",
    errorAnalysis: "❌ দুঃখিত, ছবিটি বিশ্লেষণ করতে পারিনি। অনুগ্রহ করে খাদ্য লেবেলের পরিষ্কার ছবি পাঠান।",
    errorClaims: "❌ দুঃখিত, দাবি যাচাই করতে পারিনি। অনুগ্রহ করে পরিষ্কার ছবি পাঠান।",
  },
  ta: {
    photoReceived: "📷 புகைப்படம் கிடைத்தது! நான் என்ன செய்ய வேண்டும்?",
    analyzeLabel: "🔍 லேபிள் பகுப்பாய்வு",
    checkClaims: "🎯 விளம்பர சோதனை",
    selectedAnalyze: "📷 புகைப்படம் கிடைத்தது! நீங்கள் தேர்ந்தெடுத்தது: 🔍 லேபிள் பகுப்பாய்வு",
    selectedClaims: "📷 புகைப்படம் கிடைத்தது! நீங்கள் தேர்ந்தெடுத்தது: 🎯 விளம்பர சோதனை",
    analyzing: "🔍 உணவு லேபிளை பகுப்பாய்வு செய்கிறேன்...",
    checkingClaims: "🎯 மார்க்கெட்டிங் விளம்பரங்களை சோதிக்கிறேன்...",
    analysisTitle: "📋 *உணவு பகுப்பாய்வு:*",
    claimsTitle: "🎯 *மார்க்கெட்டிங் விளம்பர சோதனை:*",
    audioCaption: "🔊 உங்கள் உணவு பகுப்பாய்வை கேளுங்கள்",
    noPhoto: "❌ புகைப்படம் இல்லை. புதிய புகைப்படம் அனுப்புங்கள்.",
    profileFirst: "முதலில் /start மூலம் உங்கள் சுயவிவரத்தை உருவாக்குங்கள்",
    processing: "⏳ முந்தைய படத்தை செயலாக்குகிறேன். காத்திருங்கள்.",
    errorAnalysis: "❌ மன்னிக்கவும், படத்தை பகுப்பாய்வு செய்ய முடியவில்லை. தெளிவான உணவு லேபிள் படம் அனுப்புங்கள்.",
    errorClaims: "❌ மன்னிக்கவும், விளம்பரங்களை சோதிக்க முடியவில்லை. தெளிவான படம் அனுப்புங்கள்.",
  },
};

// Helper to get translated text
const t = (lang, key) => TRANSLATIONS[lang]?.[key] || TRANSLATIONS.en[key];

/**
 * Registers photo handler for the bot
 */
const registerPhotoHandler = (bot) => {
  // Handle photo upload - show inline keyboard
  bot.on(message("photo"), async (ctx) => {
    // 1. Ensure language is selected
    const ok = await ensureLanguageSelected(ctx);
    if (!ok) return;

    const lang = getUserLanguage(ctx);

    if (!hasUserProfile(ctx.from.id)) {
      await ctx.reply(t(lang, "profileFirst"));
      return;
    }

    // 2. Prevent concurrent processing per user
    if (ctx.session?.isProcessing) {
      return ctx.reply(t(lang, "processing"));
    }

    const photo = ctx.message.photo.at(-1);
    const userId = ctx.from.id;

    // Store photo info for later processing (include language)
    pendingPhotos.set(userId, {
      fileId: photo.file_id,
      timestamp: Date.now(),
      lang: lang,
    });

    // Show inline keyboard with options in user's language
    await ctx.reply(
      t(lang, "photoReceived"),
      Markup.inlineKeyboard([
        [
          Markup.button.callback(t(lang, "analyzeLabel"), "action_analyze"),
          Markup.button.callback(t(lang, "checkClaims"), "action_claims"),
        ],
      ])
    );
  });

  // Handle "Analyze Label" button
  bot.action("action_analyze", async (ctx) => {
    await ctx.answerCbQuery();
    
    const userId = ctx.from.id;
    const photoData = pendingPhotos.get(userId);
    const lang = photoData?.lang || getUserLanguage(ctx);
    
    // Remove inline keyboard
    await ctx.editMessageText(t(lang, "selectedAnalyze"));

    if (!photoData) {
      return ctx.reply(t(lang, "noPhoto"));
    }

    // Process analysis in background
    processAnalysis(ctx, photoData.fileId, lang).catch((err) => {
      console.error("Analysis Error:", err);
    });

    pendingPhotos.delete(userId);
  });

  // Handle "Check Claims" button
  bot.action("action_claims", async (ctx) => {
    await ctx.answerCbQuery();
    
    const userId = ctx.from.id;
    const photoData = pendingPhotos.get(userId);
    const lang = photoData?.lang || getUserLanguage(ctx);
    
    // Remove inline keyboard
    await ctx.editMessageText(t(lang, "selectedClaims"));

    if (!photoData) {
      return ctx.reply(t(lang, "noPhoto"));
    }

    // Process claims check in background
    processClaimsCheck(ctx, photoData.fileId, lang).catch((err) => {
      console.error("Claims Check Error:", err);
    });

    pendingPhotos.delete(userId);
  });
};

/**
 * Handles food label analysis (original flow)
 */
async function processAnalysis(ctx, fileId, lang) {
  if (!ctx.session) ctx.session = {};
  ctx.session.isProcessing = true;

  const uploadsDir = path.resolve(process.cwd(), "uploads");
  const imagePath = path.join(uploadsDir, `${ctx.from.id}_${fileId}.jpg`);
  let audioPath = null;

  try {
    await ctx.reply(t(lang, "analyzing"));

    // Ensure uploads directory exists
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    // 1. Download image from Telegram
    await downloadTelegramFile(ctx, fileId, imagePath);

    // 2. Extract structured data (OCR + JSON)
    const prescriptionData = await extractPrescription(imagePath);

    const profileData = getUserProfile(ctx.from.id);

    // 3. Generate food analysis (text)
    const foodAdvice = await getDetailsFromData(prescriptionData, profileData, lang);

    // 4. Send text response
    await ctx.reply(`${t(lang, "analysisTitle")}\n\n${foodAdvice}`, {
      parse_mode: "Markdown",
    });

    // 5. Generate voice (Edge TTS)
    await ctx.sendChatAction("record_voice");
    try {
      const uniqueId = `${ctx.from.id}_${Date.now()}`;
      const audioFileName = `advice_${uniqueId}.mp3`;
      audioPath = await generateTTS(foodAdvice, audioFileName, lang);
    } catch (ttsErr) {
      console.warn("Edge TTS failed", ttsErr);
    }

    // 6. Send audio
    if (audioPath) {
      await ctx.replyWithAudio(
        { source: audioPath },
        {
          title: "JaaneKhana Audio",
          caption: t(lang, "audioCaption"),
        }
      );
    }
  } catch (err) {
    console.error("Analysis Error:", err);
    await ctx.reply(t(lang, "errorAnalysis"));
  } finally {
    ctx.session.isProcessing = false;
    if (fs.existsSync(imagePath)) await deleteFile(imagePath);
    if (audioPath && fs.existsSync(audioPath)) fs.unlinkSync(audioPath);
  }
}

/**
 * Handles marketing claims check
 */
async function processClaimsCheck(ctx, fileId, lang) {
  if (!ctx.session) ctx.session = {};
  ctx.session.isProcessing = true;

  const uploadsDir = path.resolve(process.cwd(), "uploads");
  const imagePath = path.join(uploadsDir, `${ctx.from.id}_${fileId}.jpg`);

  try {
    await ctx.reply(t(lang, "checkingClaims"));

    // Ensure uploads directory exists
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    // 1. Download image from Telegram
    await downloadTelegramFile(ctx, fileId, imagePath);

    // 2. Detect marketing claims
    const claimsResult = await detectMarketingClaims(imagePath);

    // 3. Send result
    await ctx.reply(`${t(lang, "claimsTitle")}\n\n${claimsResult}`, {
      parse_mode: "Markdown",
    });
  } catch (err) {
    console.error("Claims Check Error:", err);
    await ctx.reply(t(lang, "errorClaims"));
  } finally {
    ctx.session.isProcessing = false;
    if (fs.existsSync(imagePath)) await deleteFile(imagePath);
  }
}

export default registerPhotoHandler;

