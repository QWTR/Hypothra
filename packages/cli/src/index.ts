#!/usr/bin/env node
import { open, writeFile } from "node:fs/promises";
import { exampleScenario, simulateGrowth } from "@hypothra/simulation-core";
import { scanProject } from "@hypothra/project-scanner";

const help = `Hypothra 0.1.0 — reproducible scenario simulations

Usage:
  hypothra init                         Write hypothra.scenario.json; never overwrite
  hypothra simulate                     Run the built-in example
  hypothra simulate --config <file>     Run an explicit JSON scenario (max 64 KiB)
  hypothra analyze <directory>          Read only package.json (scanner scaffold)
  hypothra --help
  hypothra --version

Results are JSON. No AI API key, telemetry, or network access is used.
Packages are local development workspaces; they are not published to npm.`;

async function readScenario(path: string): Promise<unknown> {
  const file = await open(path, "r");
  try {
    const info = await file.stat();
    if (!info.isFile() || info.size > 65_536) throw new Error("Scenario must be a regular JSON file of at most 64 KiB.");
    const buffer = Buffer.alloc(65_537);
    const { bytesRead } = await file.read(buffer, 0, buffer.length, 0);
    if (bytesRead > 65_536) throw new Error("Scenario exceeds the 64 KiB limit.");
    return JSON.parse(buffer.subarray(0, bytesRead).toString("utf8"));
  } finally {
    await file.close();
  }
}

async function main(args: string[]) {
  const [command, ...rest] = args;
  if ((command === undefined || command === "--help" || command === "help") && rest.length === 0) return console.log(help);
  if (command === "--version" && rest.length === 0) return console.log("0.1.0");
  if (command === "init" && rest.length === 0) {
    await writeFile("hypothra.scenario.json", JSON.stringify(exampleScenario, null, 2) + "\n", { flag: "wx" });
    return console.log("Created hypothra.scenario.json. Edit assumptions, then run hypothra simulate --config hypothra.scenario.json.");
  }
  if (command === "simulate") {
    if (rest.length === 0) return console.log(JSON.stringify(simulateGrowth(exampleScenario), null, 2));
    if (rest.length === 2 && rest[0] === "--config" && rest[1]) {
      return console.log(JSON.stringify(simulateGrowth(await readScenario(rest[1])), null, 2));
    }
  }
  if (command === "analyze" && rest.length === 1 && rest[0]) {
    return console.log(JSON.stringify(await scanProject(rest[0]), null, 2));
  }
  throw new Error("Invalid command or arguments. Run hypothra --help.");
}

main(process.argv.slice(2)).catch((error: unknown) => {
  const detail = error instanceof Error ? error.message : "Unexpected failure.";
  console.error(`Hypothra: ${detail}`);
  process.exitCode = 1;
});
