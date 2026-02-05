#!/usr/bin/env node
import "dotenv/config";
import { spawn } from "node:child_process";

const pythonBin =
  (process.env.PYTHON_BIN && String(process.env.PYTHON_BIN).trim()) || "python";

const child = spawn(pythonBin, ["-m", "edge_tts", "--list-voices"], {
  stdio: "inherit",
  windowsHide: true,
});

child.on("close", (code) => {
  process.exit(code ?? 1);
});
