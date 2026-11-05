import { constants } from "node:fs";
import { lstat, open, realpath } from "node:fs/promises";
import { join } from "node:path";
export { inspectProject, redact } from "./inspect.js";
export type { Inspection, Evidence } from "./inspect.js";

/** Scaffold: reads ONLY the selected directory's package.json, never source code. */
export async function scanProject(directory: string) {
  const root = await realpath(directory);
  if (!(await lstat(root)).isDirectory()) throw new Error("Project root must be a directory.");
  const manifestPath = join(root, "package.json");
  const before = await lstat(manifestPath);
  if (before.isSymbolicLink() || !before.isFile()) throw new Error("package.json must be a regular file, not a symlink.");
  const canonical = await realpath(manifestPath);
  if (canonical !== manifestPath) throw new Error("Manifest path redirects outside the selected file.");
  const file = await open(manifestPath, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
  try {
    const info = await file.stat();
    if (!info.isFile() || info.dev !== before.dev || info.ino !== before.ino) throw new Error("Manifest changed during scan.");
    if (info.size > 65_536) throw new Error("package.json exceeds the 64 KiB limit.");
    const buffer = Buffer.alloc(65_537);
    const { bytesRead } = await file.read(buffer, 0, buffer.length, 0);
    if (bytesRead > 65_536) throw new Error("package.json exceeds the 64 KiB limit.");
    const manifest: unknown = JSON.parse(buffer.subarray(0, bytesRead).toString("utf8"));
    if (!manifest || typeof manifest !== "object" || Array.isArray(manifest)) throw new Error("package.json must contain an object.");
    const record = manifest as Record<string, unknown>;
    const names = (section: unknown): string[] => section && typeof section === "object" && !Array.isArray(section)
      ? Object.entries(section).filter(([, value]) => typeof value === "string").map(([name]) => name).sort() : [];
    return {
      status: "manifest-only-scaffold" as const,
      dependencies: names(record.dependencies),
      devDependencies: names(record.devDependencies),
      limitations: ["No source analysis, script execution, infrastructure detection, or capacity estimation."],
    };
  } finally {
    await file.close();
  }
}
