import { spawn } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const cwd = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const child = spawn("pnpm", ["exec", "next", "dev", "--port", "3005"], {
  cwd,
  stdio: "inherit",
  shell: true,
  env: {
    ...process.env,
    AYLLUU_APP: "movil",
    NEXT_PUBLIC_AYLLUU_APP: "movil",
    PORT: "3005",
  },
});

child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  process.exit(code ?? 0);
});
