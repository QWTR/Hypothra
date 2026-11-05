import { constants } from "node:fs";
import { lstat, mkdir, open, realpath, rename, unlink } from "node:fs/promises";
import { join, resolve } from "node:path";
import { createHash, randomUUID } from "node:crypto";
import type { z } from "zod";

export function revision(value: unknown): string {
  const canonical = (item: unknown): unknown => Array.isArray(item) ? item.map(canonical)
    : item !== null && typeof item === "object" ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => a.localeCompare(b, "en")).map(([key, child]) => [key, canonical(child)])) : item;
  return createHash("sha256").update(JSON.stringify(canonical(value))).digest("hex");
}

export async function readJson<T>(path: string, schema?: z.ZodType<T>, limit = 2 * 1024 * 1024): Promise<T> {
  const before = await lstat(path);
  if (before.isSymbolicLink() || !before.isFile() || before.size > limit) throw new Error("JSON input must be a regular, non-symlink file within its byte budget.");
  const file = await open(path, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
  try {
    const info = await file.stat();
    if (!info.isFile() || info.ino !== before.ino || info.dev !== before.dev) throw new Error("Input changed while opening.");
    const buffer = Buffer.alloc(limit + 1);
    let count = 0;
    while (count < buffer.length) {
      const result = await file.read(buffer, count, buffer.length - count, count);
      if (!result.bytesRead) break;
      count += result.bytesRead;
    }
    if (count > limit) throw new Error("JSON input exceeds its byte budget.");
    let input: unknown;
    try { input = JSON.parse(buffer.subarray(0, count).toString("utf8")); }
    catch { throw new Error("Invalid JSON. Check the file syntax."); }
    return schema ? schema.parse(input) : input as T;
  } finally { await file.close(); }
}

export async function workspace(directory: string, create = false): Promise<string> {
  const root = await realpath(directory);
  if (!(await lstat(root)).isDirectory()) throw new Error("Project root must be a directory.");
  const path = join(root, ".hypothra");
  if (create) await mkdir(path, { recursive: true });
  const info = await lstat(path);
  if (info.isSymbolicLink() || !info.isDirectory() || await realpath(path) !== path) throw new Error(".hypothra must be a real directory inside the project.");
  return path;
}

export async function withLock<T>(directory: string, task: (path: string) => Promise<T>): Promise<T> {
  const path = await workspace(directory, true);
  const lockPath = join(path, ".lock");
  let lock;
  try { lock = await open(lockPath, "wx"); }
  catch { throw new Error("Another Hypothra operation is active. If a process crashed, inspect .hypothra/.lock before removing it."); }
  try { return await task(path); }
  finally { await lock.close(); await unlink(lockPath); }
}

export async function writeArtifact(path: string, name: string, value: unknown, raw = false) {
  if (!/^[a-zA-Z0-9_.-]+$/.test(name)) throw new Error("Invalid artifact name.");
  const destination = resolve(path, name);
  try { if ((await lstat(destination)).isSymbolicLink()) throw new Error("Refusing to replace a symlinked artifact."); }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
  const temp = join(path, `.tmp-${randomUUID()}`);
  try {
    const file = await open(temp, "wx");
    try { await file.writeFile(raw ? String(value) : JSON.stringify(value, null, 2) + "\n"); }
    finally { await file.close(); }
    await rename(temp, destination);
  } finally { await unlink(temp).catch(() => {}); }
}
