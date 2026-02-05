import express from "express";
import { elevenLabsTTS } from "../services/eleven.service.js";
const router = express.Router();

// POST /api/tts
// body: { text: string, filename?: string }
router.post("/api/tts", async (req, res) => {
  try {
    const { text, filename, lang } = req.body || {};
    if (!text || typeof text !== "string") {
      return res.status(400).json({ error: "Missing text in request body" });
    }

    const name = filename && typeof filename === "string" ? filename : `tts_${Date.now()}.mp3`;
    const filePath = await elevenLabsTTS(text, name, lang);

    // construct public URL assuming server runs on localhost:3000
    const host = req.get("host") || "localhost:3000";
    const protocol = req.protocol || "http";
    const url = `${protocol}://${host}/uploads/${encodeURIComponent(name)}`;

    return res.json({ path: filePath, url });
  } catch (err) {
    console.error("TTS error:", err);
    return res.status(500).json({ error: String(err?.message || err) });
  }
});

export default router;
