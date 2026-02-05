# MedEase

## Environment

- **ELEVEN_API_KEY**: Required for ElevenLabs TTS. Set this to your ElevenLabs API key.
- **ELEVEN_VOICE_ID** (optional): Preferred voice id to use for TTS. If not set, the service will attempt to fall back to a default or the first available voice.

To list available ElevenLabs voices (useful to pick a valid `ELEVEN_VOICE_ID`):

```bash
ELEVEN_API_KEY=your_key_here node scripts/list_eleven_voices.js
```
