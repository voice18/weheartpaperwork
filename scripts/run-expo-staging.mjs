import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const expoCli = fileURLToPath(
  new URL("../node_modules/expo/bin/cli", import.meta.url)
);
const child = spawn(process.execPath, [expoCli, ...process.argv.slice(2)], {
  env: {
    ...process.env,
    EXPO_PUBLIC_APP_ENV: "staging",
  },
  stdio: "inherit",
});

child.on("error", (error) => {
  console.error("Unable to start the staging Expo command.", error);
  process.exit(1);
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 1);
});
