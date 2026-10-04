import { spawn } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { movilEnv } from "./movil-env.mjs";

const cwd = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const child = spawn("pnpm", ["exec", "next", "dev", "--port", "3005"], {
  cwd,
  stdio: "inherit",
  shell: true,
  env: {
    ...process.env,
    ...movilEnv(),
  },
});

child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  process.exit(code ?? 0);
});
