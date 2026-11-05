import { spawn } from "node:child_process";
// Automated checks use controlled model responses; never consume a developer's AI account.
const child = spawn(process.execPath, ["--test", "tests/*.test.mjs"], {
  stdio: "inherit", windowsHide: true, env: { ...process.env, HYPOTHRA_AI_MODE: "off" },
});
child.on("error", () => { process.exitCode = 1; });
child.on("exit", code => { process.exitCode = code ?? 1; });
