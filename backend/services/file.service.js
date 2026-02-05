import fs from "node:fs";
import { pipeline } from "node:stream/promises";

export async function downloadTelegramFile(ctx, fileId, destination) {
  if (!fs.existsSync("uploads")) fs.mkdirSync("uploads");

  const fileLink = await ctx.telegram.getFileLink(fileId);
  const response = await fetch(fileLink.href);
  await pipeline(response.body, fs.createWriteStream(destination));
}

export function deleteFile(path) {
  if (fs.existsSync(path)) fs.unlinkSync(path);
}
