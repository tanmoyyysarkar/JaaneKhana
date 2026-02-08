# JaaneKhana (Hackathon Project)

JaaneKhana is an AI-powered **food label copilot** that helps users understand ingredients, allergens, nutrition highlights, and potentially misleading marketing claims. It supports:

- **Web app** (React + Vite + Tailwind)
- **Telegram bot** (Telegraf) for “scan & ask” usage
- **Google Gemini 2.5** for vision-based label understanding (no separate OCR engine)
- **Text-to-Speech (TTS)** using Microsoft Edge neural voices via a small Python worker (`edge-tts`)

---

## Repository layout

- `frontend/` — React + TypeScript + Vite UI
- `backend/` — Express API + Telegram bot + Gemini + TTS services

---

## Prerequisites

- Node.js 18+ (recommended)
- Python 3.9+ (for TTS)
- A Google Gemini API key
- A Telegram bot token (if you want to run the bot)

---

## Environment variables

Create `backend/.env` (or set env vars in your hosting provider):

```bash
# Required for Gemini
GEMINI_API_KEY=your_key_here

# Required for Telegram bot
TELEGRAM_BOT_TOKEN=your_token_here

# Optional: server
PORT=3000

# Optional: TTS runtime overrides
PYTHON_BIN=python3
EDGE_TTS_SCRIPT=./tts.py

# Optional: voice overrides per language
EDGE_TTS_VOICE_EN=en-US-AriaNeural
EDGE_TTS_VOICE_HI=hi-IN-SwaraNeural
EDGE_TTS_VOICE_BN=bn-IN-TanishaaNeural
EDGE_TTS_VOICE_TA=ta-IN-PallaviNeural
```

Notes:
- TTS uses a **Python subprocess**. The backend will call `PYTHON_BIN EDGE_TTS_SCRIPT ...`.
- Audio files are written to `backend/uploads/`.

---

## Install & run (local)

### 1) Backend

```bash
cd backend
npm install
npm run dev
```

Backend runs by default on `http://localhost:3000`.

### 2) Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend runs by default on `http://localhost:5173`.

---

## TTS setup (Python)

TTS is implemented using `edge-tts` in `backend/tts.py`, called from Node in `backend/services/tts.service.js`.

Install the Python dependency in your environment:

```bash
python3 -m pip install edge-tts
```

How it works (high-level):
- Node writes the text to a UTF-8 temp file in `uploads/`.
- Node spawns Python: `tts.py @temp.txt <voiceId> <output.mp3>`.
- Python uses `edge_tts.Communicate(...).save(output_file)`.

If TTS fails, error details are logged under `backend/logs/` as `edge_tts_error_*.json`.

---

## Gemini “OCR” / Vision understanding

JaaneKhana does not use a separate OCR engine (like Tesseract). Instead, it uses **Gemini’s multimodal vision**:
- The uploaded image is converted to base64 using `backend/utils/generative.util.js`.
- The image is sent to Gemini with a strict prompt (and optional schema constraints).

Key services:
- `backend/services/gemini.service.js`

---

## API endpoints (backend)

Gemini:
- `POST /api/gemini/upload` — Analyze a food label image (multipart form-data: `imagePath`)
- `POST /api/gemini/marketing-claims` — Detect misleading marketing claims (multipart form-data: `imagePath`)

Profile:
- `GET /api/profile/options` — Returns options used by the UI (diets, conditions, allergies, goals)

Uploads:
- `GET /uploads/<file>` — Serves generated files (e.g., MP3)

---

## Telegram bot workflow (backend)

The bot is built with Telegraf and mounted into Express via webhook callback.

User flow:
1. `/start` → select language → complete profile wizard
2. Send a food label photo
3. Choose action: **Analyze Label** or **Check Claims**
4. Receive text insights and optional audio response

---

## Scaling notes (for production)

This repo is optimized for hackathon/demo speed. For production-scale traffic, consider:
- Moving uploads from memory to disk/object storage
- Adding rate limiting and a queue (Gemini + TTS concurrency caps)
- Persisting bot profiles/sessions in Redis/DB (instead of in-memory Maps)
- Running multiple backend instances behind a load balancer

---

## License

See `backend/LICENSE`.
