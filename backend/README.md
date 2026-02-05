# MedEase

## Environment

### Edge TTS (Free)

This backend uses Microsoft Edge "Read Aloud" voices via the `edge-tts` Python library.

Prerequisites:
- Python installed
- `pip install edge-tts`

Environment variables:
- **PYTHON_BIN** (optional): Python executable name/path (default: `python`)
- **EDGE_TTS_SCRIPT** (optional): Path to the python runner script (default: `./tts.py`)
- **EDGE_TTS_VOICE_AS** (optional): Assamese voice id (default: `bn-IN-TanishaaNeural`, fallback because Edge TTS doesn't expose as-IN voices)
- **EDGE_TTS_VOICE_BN** (optional): Bengali voice id (default: `bn-IN-TanishaaNeural`)
- **EDGE_TTS_VOICE_HI** (optional): Hindi voice id (default: `hi-IN-SwaraNeural`)
- **EDGE_TTS_VOICE_TA** (optional): Tamil voice id (default: `ta-IN-PallaviNeural`)
- **EDGE_TTS_VOICE_EN** (optional): English voice id (default: `en-US-AriaNeural`)

To list available Edge TTS voices:

```bash
node scripts/list_edge_voices.js
```
