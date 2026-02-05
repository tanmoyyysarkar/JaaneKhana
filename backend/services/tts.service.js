import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { spawn } from "node:child_process";

function safeStringify(value, replacer) {
  const seen = new WeakSet();
  return JSON.stringify(
    value,
    (key, val) => {
      if (typeof replacer === "function") {
        val = replacer(key, val);
      }
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

async function writeTtsErrorLog(payload) {
  await fs.mkdir("./logs", { recursive: true });
  const file = `./logs/edge_tts_error_${payload.requestId}_${Date.now()}.json`;
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

  try {
    out.raw = JSON.parse(safeStringify(err, (k, v) => (k === "apiKey" ? "[REDACTED]" : v)));
  } catch {
    // ignore
  }

  return out;
}

function boolEnv(name) {
  return Boolean(process.env[name] && String(process.env[name]).trim());
}

const EDGE_VOICE_ENV_BY_LANG = {
  en: "EDGE_TTS_VOICE_EN",
  hi: "EDGE_TTS_VOICE_HI",
  bn: "EDGE_TTS_VOICE_BN",
  as: "EDGE_TTS_VOICE_AS",
  ta: "EDGE_TTS_VOICE_TA",
};

const EDGE_VOICE_DEFAULT_BY_LANG = {
  en: "en-US-AriaNeural",
  hi: "hi-IN-SwaraNeural",
  bn: "bn-IN-TanishaaNeural",
  // NOTE: Edge TTS currently does not expose as-IN voices.
  // Use Bengali as the closest available fallback.
  as: "bn-IN-TanishaaNeural",
  ta: "ta-IN-PallaviNeural",
};

function normalizeLang(lang) {
  if (!lang || typeof lang !== "string") return "en";
  const code = lang.trim().toLowerCase();
  return Object.prototype.hasOwnProperty.call(EDGE_VOICE_ENV_BY_LANG, code)
    ? code
    : "en";
}

function pickEdgeVoice(langCode) {
  const envName = EDGE_VOICE_ENV_BY_LANG[langCode];
  const fromEnv = envName ? process.env[envName] : undefined;
  const fromDefault =
    EDGE_VOICE_DEFAULT_BY_LANG[langCode] || EDGE_VOICE_DEFAULT_BY_LANG.en;

  let voiceId = (fromEnv && String(fromEnv).trim()) || fromDefault;
  let voiceSource = (fromEnv && String(fromEnv).trim())
    ? envName
    : "<default>";

  // Hard guard: if Assamese is selected but an as-IN voice is configured (not available), force fallback.
  if (langCode === "as" && /^as-IN-/i.test(voiceId)) {
    voiceId = EDGE_VOICE_DEFAULT_BY_LANG.as;
    voiceSource = "fallback:bn-IN";
  }

  return { voiceId, voiceSource };
}

function resolvePythonBin() {
  const v = process.env.PYTHON_BIN;
  return (v && String(v).trim()) || "python";
}

function resolveScriptPath() {
  const raw =
    (process.env.EDGE_TTS_SCRIPT && String(process.env.EDGE_TTS_SCRIPT).trim()) ||
    "./tts.py";
  return path.isAbsolute(raw) ? raw : path.resolve(process.cwd(), raw);
}

async function runEdgeTtsPython({ requestId, text, voiceId, outputPath }) {
  const pythonBin = resolvePythonBin();
  const scriptPath = resolveScriptPath();

  // Write text to a temp file as UTF-8 to avoid Windows stdin encoding issues
  const tempDir = path.resolve(process.cwd(), "uploads");
  await fs.mkdir(tempDir, { recursive: true });
  const tempTextFile = path.join(tempDir, `tts_input_${requestId}.txt`);
  await fs.writeFile(tempTextFile, text || "", "utf8");

  // Pass @tempTextFile so Python reads UTF-8 file
  const args = [scriptPath, `@${tempTextFile}`, voiceId, outputPath];

  try {
    return await new Promise((resolve, reject) => {
      const child = spawn(pythonBin, args, {
        stdio: ["ignore", "pipe", "pipe"],
        windowsHide: true,
      });

      let stdout = "";
      let stderr = "";

      child.stdout?.on("data", (d) => (stdout += d.toString()));
      child.stderr?.on("data", (d) => (stderr += d.toString()));

      child.on("error", (err) => {
        reject({
          kind: "spawn_error",
          err,
          stdout,
          stderr,
          pythonBin,
          args,
          scriptPath,
        });
      });

      child.on("close", (code, signal) => {
        if (code === 0) return resolve({ stdout, stderr });
        reject({
          kind: "nonzero_exit",
          code,
          signal,
          stdout,
          stderr,
          pythonBin,
          args,
          scriptPath,
        });
      });
    });
  } finally {
    try {
      await fs.unlink(tempTextFile);
    } catch {
      // ignore cleanup errors
    }
  }
}

/**
 * Generate text-to-speech audio using Edge TTS (Python edge-tts).
 * @param {string} text
 * @param {string} filename
 * @param {string} lang
 */
export async function generateTTS(text, filename = "advice.mp3", lang = "en") {
  const requestId = crypto.randomUUID();
  const langCode = normalizeLang(lang);
  const { voiceId, voiceSource } = pickEdgeVoice(langCode);
  const startedAt = Date.now();

  await fs.mkdir("./uploads", { recursive: true });
  const outputPath = path.resolve(process.cwd(), "uploads", filename);

  try {
    let stdout = "";
    let stderr = "";

    try {
      ({ stdout, stderr } = await runEdgeTtsPython({
        requestId,
        text,
        voiceId,
        outputPath,
      }));
    } catch (e) {
      // If Assamese voice fails (NoAudioReceived), retry once with Bengali fallback.
      const errText = String(e?.stderr || e?.message || e);
      const shouldRetryAsFallback =
        langCode === "as" &&
        (errText.includes("NoAudioReceived") ||
          errText.includes("No audio was received"));

      if (!shouldRetryAsFallback) throw e;

      const retryVoiceId = EDGE_VOICE_DEFAULT_BY_LANG.as;
      console.warn(
        "[EdgeTTS] Assamese voice unavailable; retrying with fallback voice",
        {
          requestId,
          fromVoice: voiceId,
          toVoice: retryVoiceId,
        }
      );

      ({ stdout, stderr } = await runEdgeTtsPython({
        requestId,
        text,
        voiceId: retryVoiceId,
        outputPath,
      }));
    }

    const tookMs = Date.now() - startedAt;
    console.log(
      `[EdgeTTS] audio generated in ${tookMs}ms (requestId=${requestId}, lang=${langCode}, voice=${voiceId}, file=${filename})`
    );

    if (process.env.EDGE_TTS_DEBUG === "1") {
      console.log("[EdgeTTS] success", {
        requestId,
        lang: langCode,
        voiceId,
        voiceSource,
        filename,
        textLength: typeof text === "string" ? text.length : null,
        tookMs,
        stdout: stdout ? stdout.slice(0, 500) : "",
        stderr: stderr ? stderr.slice(0, 500) : "",
      });
    }

    return outputPath;
  } catch (err) {
    const errMsg = String(err?.message || err?.stderr || err);

    try {
      const logPath = await writeTtsErrorLog({
        requestId,
        at: new Date().toISOString(),
        context: {
          filename,
          lang: normalizeLang(lang),
          voiceId,
          voiceSource,
          env: {
            PYTHON_BIN: process.env.PYTHON_BIN || "python",
            EDGE_TTS_SCRIPT: process.env.EDGE_TTS_SCRIPT || "./tts.py",
            EDGE_TTS_VOICE_EN_set: boolEnv("EDGE_TTS_VOICE_EN"),
            EDGE_TTS_VOICE_HI_set: boolEnv("EDGE_TTS_VOICE_HI"),
            EDGE_TTS_VOICE_BN_set: boolEnv("EDGE_TTS_VOICE_BN"),
            EDGE_TTS_VOICE_AS_set: boolEnv("EDGE_TTS_VOICE_AS"),
            EDGE_TTS_VOICE_TA_set: boolEnv("EDGE_TTS_VOICE_TA"),
            EDGE_TTS_DEBUG: process.env.EDGE_TTS_DEBUG || "0",
          },
          textLength: typeof text === "string" ? text.length : null,
          outputPath,
        },
        error: pickErrorDetails(err),
      });

      console.warn("[EdgeTTS] failed", {
        requestId,
        message: errMsg,
        logPath,
      });
    } catch (logErr) {
      console.warn("[EdgeTTS] Failed to write error log", {
        requestId,
        message: String(logErr?.message || logErr),
      });
    }

    throw new Error(`Edge TTS failed (requestId: ${requestId}): ${errMsg}`);
  }
}
