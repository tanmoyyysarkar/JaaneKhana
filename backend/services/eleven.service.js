import fetch from "node-fetch";
import fs from "node:fs/promises";
import { createWriteStream } from "node:fs";
import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";
import crypto from "node:crypto";

function safeStringify(value) {
  const seen = new WeakSet();
  return JSON.stringify(
    value,
    (key, val) => {
      if (typeof val === "bigint") return val.toString();
      if (typeof val === "object" && val !== null) {
        if (seen.has(val)) return "[Circular]";
        seen.add(val);
      }
      if (typeof val === "function") return "[Function]";
      return val;
    },
    2
  );
}

async function writeElevenErrorLog(payload) {
  await fs.mkdir("./logs", { recursive: true });
  const file = `./logs/eleven_tts_error_${payload.requestId}_${Date.now()}.json`;
  await fs.writeFile(file, safeStringify(payload), "utf8");
  return file;
}

function pickErrorDetails(err) {
  const out = {
    name: err?.name,
    message: err?.message,
    stack: err?.stack,
    status: err?.status,
    statusCode: err?.statusCode,
    code: err?.code,
  };

  // Many SDKs attach a response/body; capture if present.
  if (err?.response) {
    out.response = {
      status: err.response.status,
      statusText: err.response.statusText,
      headers: err.response.headers,
      data: err.response.data,
      body: err.response.body,
    };
  }

  if (err?.cause) {
    out.cause = pickErrorDetails(err.cause);
  }

  // Last-resort snapshot (kept small-ish)
  try {
    out.raw = JSON.parse(
      safeStringify(err, (k, v) => (k === "apiKey" ? "[REDACTED]" : v))
    );
  } catch {
    // ignore
  }

  return out;
}

function boolEnv(name) {
  return Boolean(process.env[name] && String(process.env[name]).trim());
}

const VOICE_ENV_BY_LANG = {
  en: "ELEVEN_VOICE_ID_EN",
  hi: "ELEVEN_VOICE_ID_HI",
  bn: "ELEVEN_VOICE_ID_BN",
  as: "ELEVEN_VOICE_ID_AS",
  ta: "ELEVEN_VOICE_ID_TA",
};

function normalizeLang(lang) {
  if (!lang || typeof lang !== "string") return "en";
  const code = lang.trim().toLowerCase();
  return Object.prototype.hasOwnProperty.call(VOICE_ENV_BY_LANG, code) ? code : "en";
}

function pickVoiceIdForLang(langCode) {
  const envName = VOICE_ENV_BY_LANG[langCode];
  const specific = envName ? process.env[envName] : undefined;
  const generic = process.env.ELEVEN_VOICE_ID;

  const voiceId =
    (specific && String(specific).trim()) ||
    (generic && String(generic).trim()) ||
    "JBFqnCBsd6RMkjVDRZzb";

  const voiceEnv = (specific && String(specific).trim())
    ? envName
    : (generic && String(generic).trim())
      ? "ELEVEN_VOICE_ID"
      : "<default>";

  return { voiceId, voiceEnv };
}

/**
 * Generate speech using ElevenLabs
 * @param {string} text
 * @param {string} filename
 */
export async function elevenLabsTTS(text, filename = "advice.mp3", lang = "en") {
  // Back-compat: allow accidental (text, 'bn') usage
  if (arguments.length === 2 && typeof filename === "string" && filename.length <= 5) {
    lang = filename;
    filename = `advice_${Date.now()}.mp3`;
  }

  const requestId = crypto.randomUUID();
  const ELEVEN_API_KEY = process.env.ELEVEN_API_KEY;
  if (!ELEVEN_API_KEY) {
    throw new Error("ElevenLabs API key not set");
  }

  const langCode = normalizeLang(lang);
  const { voiceId, voiceEnv } = pickVoiceIdForLang(langCode);
  const startedAt = Date.now();

  const client = new ElevenLabsClient({ apiKey: ELEVEN_API_KEY });

  async function streamAudioToFile(audio, filePath) {
    const reader = audio.getReader();
    await fs.mkdir("./uploads", { recursive: true });
    const writeStream = createWriteStream(filePath);

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) writeStream.write(Buffer.from(value));
      }
      writeStream.end();
      await new Promise((resolve, reject) => {
        writeStream.on("finish", resolve);
        writeStream.on("error", reject);
      });
      return filePath;
    } finally {
      // ensure stream closed
      try {
        writeStream.destroy();
      } catch (e) {}
    }
  }

  try {
    const modelId = (process.env.ELEVEN_MODEL_ID && String(process.env.ELEVEN_MODEL_ID).trim()) || "eleven_multilingual_v2";
    const outputFormat = "mp3_44100_128";
    const audio = await client.textToSpeech.convert(voiceId, {
      text,
      modelId,
      outputFormat,
    });

    const filePath = `./uploads/${filename}`;
    const outPath = await streamAudioToFile(audio, filePath);
    const tookMs = Date.now() - startedAt;
    if (process.env.ELEVEN_DEBUG === "1") {
      console.log("[ElevenLabs] TTS success", {
        requestId,
        lang: langCode,
        voiceId,
        voiceEnv,
        filename,
        textLength: typeof text === "string" ? text.length : null,
        tookMs,
      });
    }
    return outPath;
  } catch (err) {
    const errMsg = String(err?.message || err);

    // Always write a detailed log file to pinpoint failures.
    try {
      const logPath = await writeElevenErrorLog({
        requestId,
        at: new Date().toISOString(),
        context: {
          filename,
          lang: normalizeLang(lang),
          voiceId,
          voiceEnv,
          env: {
            ELEVEN_API_KEY_set: boolEnv("ELEVEN_API_KEY"),
            ELEVEN_VOICE_ID_set: boolEnv("ELEVEN_VOICE_ID"),
            ELEVEN_VOICE_ID_EN_set: boolEnv("ELEVEN_VOICE_ID_EN"),
            ELEVEN_VOICE_ID_HI_set: boolEnv("ELEVEN_VOICE_ID_HI"),
            ELEVEN_VOICE_ID_BN_set: boolEnv("ELEVEN_VOICE_ID_BN"),
            ELEVEN_VOICE_ID_AS_set: boolEnv("ELEVEN_VOICE_ID_AS"),
            ELEVEN_VOICE_ID_TA_set: boolEnv("ELEVEN_VOICE_ID_TA"),
            ELEVEN_MODEL_ID: process.env.ELEVEN_MODEL_ID || "(default)",
            ELEVEN_DEBUG: process.env.ELEVEN_DEBUG || "0",
          },
          textLength: typeof text === "string" ? text.length : null,
          modelId: (process.env.ELEVEN_MODEL_ID && String(process.env.ELEVEN_MODEL_ID).trim()) || "eleven_multilingual_v2",
          outputFormat: "mp3_44100_128",
        },
        error: pickErrorDetails(err),
      });

      console.warn("[ElevenLabs] TTS failed", {
        requestId,
        message: errMsg,
        logPath,
      });
    } catch (logErr) {
      console.warn("[ElevenLabs] Failed to write error log", {
        requestId,
        message: String(logErr?.message || logErr),
      });
    }

    // If the SDK indicates voice not found, try to list voices and retry once
    if (errMsg.includes("voice_not_found") || errMsg.includes("voice_id") || errMsg.includes("not found")) {
      try {
        const voicesResp = await fetch("https://api.elevenlabs.io/v1/voices", {
          headers: { "xi-api-key": ELEVEN_API_KEY },
        });
        if (voicesResp.ok) {
          const voicesData = await voicesResp.json();
          try {
            await fs.mkdir("./logs", { recursive: true });
            const logPath = `./logs/eleven_voices_${Date.now()}.json`;
            await fs.writeFile(logPath, JSON.stringify(voicesData, null, 2));
            console.warn("[ElevenLabs] voices written", { requestId, logPath });
          } catch (e) {
            console.warn("[ElevenLabs] Failed to write voices log", {
              requestId,
              message: String(e?.message || e),
            });
          }

          const first = (voicesData?.voices && voicesData.voices[0]) || voicesData?.[0];
          const candidateId = first?.voice_id || first?.id || first?.voiceId || first?.voice || null;
          if (candidateId && candidateId !== voiceId) {
            try {
              console.warn("[ElevenLabs] Retrying with candidate voice", {
                requestId,
                candidateId,
              });
              const audio = await client.textToSpeech.convert(candidateId, {
                text,
                modelId: "eleven_multilingual_v2",
                outputFormat: "mp3_44100_128",
              });
              const filePath = `./uploads/${filename}`;
              return await streamAudioToFile(audio, filePath);
            } catch (e) {
              // fall through to throw original
            }
          }
        }
      } catch (e) {
        console.warn("[ElevenLabs] Failed to list voices", {
          requestId,
          message: String(e?.message || e),
        });
      }
    }

    throw new Error(`ElevenLabs TTS failed (requestId: ${requestId}): ${errMsg}`);
  }
}
