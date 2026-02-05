import sys
import asyncio
import edge_tts

# Usage:
#   python tts.py @input.txt "as-IN-YashicaNeural" "output.mp3"  (read text from file)
#   python tts.py "Hello"    "en-US-AriaNeural"    "output.mp3"  (text as argv)

async def main():
    if len(sys.argv) < 4:
        raise SystemExit("Usage: python tts.py <text|@file> <voice> <output_file>")

    text_arg = sys.argv[1]
    voice = sys.argv[2]
    output_file = sys.argv[3]

    # If text_arg starts with '@', treat rest as a file path to read UTF-8 text from
    if text_arg.startswith("@"):
        file_path = text_arg[1:]
        with open(file_path, "r", encoding="utf-8") as f:
            text = f.read()
    else:
        text = text_arg

    if not text or not text.strip():
        raise SystemExit("Empty text")

    communicate = edge_tts.Communicate(text, voice)
    await communicate.save(output_file)


if __name__ == "__main__":
    asyncio.run(main())
