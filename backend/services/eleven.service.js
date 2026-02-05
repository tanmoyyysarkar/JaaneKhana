import fetch from "node-fetch";
import fs from "node:fs/promises";
import { createWriteStream } from "node:fs";
import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";

/**
 * Generate speech using ElevenLabs
 * @param {string} text
 * @param {string} filename
 */
export async function elevenLabsTTS(text, filename = "advice.mp3") {
  const ELEVEN_API_KEY = process.env.ELEVEN_API_KEY;
  if (!ELEVEN_API_KEY) {
    throw new Error("ElevenLabs API key not set");
  }
  // Prefer an explicit environment override; fallback to a legacy default.
  let voiceId = process.env.ELEVEN_VOICE_ID || "JBFqnCBsd6RMkjVDRZzb";

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
    const audio = await client.textToSpeech.convert(voiceId, {
      text,
      modelId: "eleven_multilingual_v2",
      outputFormat: "mp3_44100_128",
    });

    const filePath = `./uploads/${filename}`;
    return await streamAudioToFile(audio, filePath);
  } catch (err) {
    const errMsg = String(err?.message || err);
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
            console.warn(`ElevenLabs voices written to ${logPath}`);
          } catch (e) {
            console.warn("Failed to write ElevenLabs voices log:", e);
          }

          const first = (voicesData?.voices && voicesData.voices[0]) || voicesData?.[0];
          const candidateId = first?.voice_id || first?.id || first?.voiceId || first?.voice || null;
          if (candidateId && candidateId !== voiceId) {
            try {
              console.warn(`Retrying ElevenLabs TTS with candidate voice '${candidateId}'`);
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
        console.warn("Failed to list ElevenLabs voices:", e);
      }
    }

    throw new Error(`ElevenLabs TTS failed: ${errMsg}`);
  }
}
