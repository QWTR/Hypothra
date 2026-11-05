import { access, lstat, opendir, realpath } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, isAbsolute, join, parse } from "node:path";

/** Folder names only. The authenticated panel owns navigation; no desktop popup is needed. */
export async function listProjectFolders(requested?: string, current?: string) {
  const selected = requested || current || homedir();
  if (!isAbsolute(selected)) throw new Error("Enter a full folder path, for example D:\\MyProjects.");
  let directory: string;
  try {
    directory = await realpath(selected);
    if (!(await lstat(directory)).isDirectory()) throw new Error("not-directory");
  } catch { throw new Error("That folder could not be opened. Check the path or choose another folder."); }
  const roots: string[] = [];
  if (process.platform === "win32") {
    await Promise.all(Array.from("ABCDEFGHIJKLMNOPQRSTUVWXYZ", async letter => {
      const root = `${letter}:\\`;
      try { await Promise.race([access(root), new Promise((_, reject) => { const timer = setTimeout(() => reject(new Error("timeout")), 1200); timer.unref(); })]); roots.push(root); }
      catch { /* Unavailable drives are not listed. */ }
    }));
    roots.sort();
  } else roots.push(parse(directory).root);
  const folders: { name: string; path: string }[] = [];
  let truncated = false;
  try {
    let entries = 0;
    for await (const item of await opendir(directory)) {
      if (++entries > 10_000 || folders.length >= 1000) { truncated = true; break; }
      if (!item.isDirectory() || item.isSymbolicLink() || item.name.startsWith(".") || ["node_modules", "$RECYCLE.BIN", "System Volume Information"].includes(item.name)) continue;
      folders.push({ name: item.name, path: join(directory, item.name) });
    }
  } catch { throw new Error("This folder is not readable. Choose a different folder or enter its full path."); }
  folders.sort((a, b) => a.name.localeCompare(b.name, "en", { numeric: true }));
  return { directory, parent: dirname(directory) === directory ? null : dirname(directory), roots, folders, truncated };
}
