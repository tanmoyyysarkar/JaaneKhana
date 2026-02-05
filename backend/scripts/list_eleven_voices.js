#!/usr/bin/env node
import fetch from "node-fetch";

const ELEVEN_API_KEY = process.env.ELEVEN_API_KEY;
if (!ELEVEN_API_KEY) {
  console.error("Error: ELEVEN_API_KEY environment variable is not set.");
  process.exit(1);
}

async function main() {
  try {
    const res = await fetch("https://api.elevenlabs.io/v1/voices", {
      headers: { "xi-api-key": ELEVEN_API_KEY },
    });

    const text = await res.text();
    try {
      const json = JSON.parse(text);
      console.log(JSON.stringify(json, null, 2));
    } catch (e) {
      console.log(text);
    }
  } catch (err) {
    console.error("Failed to fetch voices:", err);
    process.exit(2);
  }
}

main();
