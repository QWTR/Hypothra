import { constants } from "node:fs";
import { lstat, open, opendir, realpath } from "node:fs/promises";
import type { Dirent } from "node:fs";
import { createHash } from "node:crypto";
import { extname, join, relative, sep } from "node:path";
import ts from "typescript-ast";
import ignore from "ignore";

export interface Evidence {
  id: string;
  kind: "dependency" | "route" | "screen" | "data-model" | "document" | "configuration" | "interaction" | "behavior" | "ui-label";
  path: string;
  line: number;
  title: string;
}
export interface Inspection {
  schemaVersion: 1;
  engine: "structural-v1";
  sourceDigest: string;
  filesScanned: number;
  bytesScanned: number;
  truncated: boolean;
  evidence: Evidence[];
  technologies: { name: string; category: string; evidenceIds: string[] }[];
  warnings: string[];
}
const excluded = new Set([".git", ".hypothra", "node_modules", "dist", "build", "coverage", ".next", ".expo", ".venv", "venv", "vendor", "__pycache__", "outputs", "android", "ios"]);
const sourceExtensions = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".py", ".prisma", ".sql", ".html", ".css"]);
const configNames = new Set(["package.json", "requirements.txt", "pyproject.toml", "go.mod", "Dockerfile", "docker-compose.yml", "compose.yml"]);
const technologies: Record<string, [string, string]> = {
  react: ["React", "frontend"], "react-native": ["React Native", "mobile"], expo: ["Expo", "mobile"],
  next: ["Next.js", "fullstack"], vue: ["Vue", "frontend"], svelte: ["Svelte", "frontend"],
  express: ["Express", "backend"], fastify: ["Fastify", "backend"], "@nestjs/core": ["NestJS", "backend"],
  "@prisma/client": ["Prisma", "database"], prisma: ["Prisma", "database"], pg: ["PostgreSQL client", "database"],
  mongoose: ["Mongoose", "database"], mongodb: ["MongoDB client", "database"], redis: ["Redis client", "database"],
  "socket.io": ["Socket.IO", "realtime"], ws: ["WebSocket client/server", "realtime"],
  stripe: ["Stripe integration", "payments"], "@stripe/stripe-react-native": ["Stripe integration", "payments"],
  "@supabase/supabase-js": ["Supabase client", "backend"], firebase: ["Firebase client", "backend"],
  typescript: ["TypeScript", "language"], playwright: ["Playwright", "testing"], vitest: ["Vitest", "testing"],
};
export const redact = (value: string): string => value
  .replace(/(?:gh[pousr]_[A-Za-z0-9_]{12,}|github_pat_[A-Za-z0-9_]+|sk-[A-Za-z0-9_-]{12,})/g, "[REDACTED]")
  .replace(/\b(?:postgres(?:ql)?|mysql|mongodb(?:\+srv)?|redis):\/\/[^\s"'`]+/gi, "[REDACTED_CONNECTION]")
  .replace(/((?:api[_-]?key|token|password|secret)\s*[:=]\s*)["']?[^\s"',;]+/gi, "$1[REDACTED]");
const clean = (value: string, max = 180): string => redact(value).replace(/[\x00-\x1f\x7f]/g, " ").slice(0, max);
const safeName = (name: string): boolean => !name.startsWith(".") && !/(?:secret|credential|private.?key|token|password|\.env)/i.test(name)
  && !/\.(?:pem|key|p12|pfx|crt|log|map|lock|sqlite|db)$/i.test(name);

/** Reads bounded, allowlisted text files; never follows links or executes target code. */
export async function inspectProject(directory: string): Promise<Inspection> {
  const root = await realpath(directory);
  if (!(await lstat(root)).isDirectory()) throw new Error("Project root must be a directory.");
  const maxFiles = 1500, maxBytes = 8 * 1024 * 1024, maxFileBytes = 128 * 1024, maxEntries = 12_000;
  const evidence: Evidence[] = [];
  const warnings = new Set<string>();
  const files: { path: string; text: string }[] = [];
  let bytesScanned = 0, entriesSeen = 0, truncated = false;
  const digest = createHash("sha256");
  const ignorer = ignore();
  async function readSafe(path: string, limit: number): Promise<string | null> {
    const before = await lstat(path);
    if (before.isSymbolicLink() || !before.isFile()) return null;
    if (before.size > limit) { warnings.add("Some files exceeded the per-file byte limit."); truncated = true; return null; }
    const canonical = await realpath(path);
    const rel = relative(root, canonical);
    if (rel === ".." || rel.startsWith(`..${sep}`) || canonical !== path) throw new Error("Scanner path containment check failed.");
    const handle = await open(path, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
    try {
      const info = await handle.stat();
      if (!info.isFile() || info.ino !== before.ino || info.dev !== before.dev) throw new Error("File changed during scan.");
      const buffer = Buffer.alloc(limit + 1);
      let count = 0;
      while (count < buffer.length) {
        const result = await handle.read(buffer, count, buffer.length - count, count);
        if (!result.bytesRead) break;
        count += result.bytesRead;
      }
      if (count > limit) { truncated = true; return null; }
      if (buffer.subarray(0, count).includes(0)) return null;
      return buffer.subarray(0, count).toString("utf8");
    } finally { await handle.close(); }
  }
  for (const name of [".gitignore", ".hypothraignore"]) {
    try {
      const text = await readSafe(join(root, name), 32_768);
      if (text !== null) { ignorer.add(text); digest.update(name).update("\0").update(text); }
    } catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
  }
  async function walk(dir: string, depth: number) {
    if (depth > 12) { truncated = true; return; }
    const listing: Dirent[] = [];
    for await (const entry of await opendir(dir)) {
      listing.push(entry);
      if (listing.length >= maxEntries - entriesSeen) { truncated = true; break; }
    }
    listing.sort((a, b) => a.name.localeCompare(b.name, "en"));
    for (const entry of listing) {
      if (++entriesSeen > maxEntries || files.length >= maxFiles || bytesScanned >= maxBytes) { truncated = true; return; }
      if (excluded.has(entry.name) || !safeName(entry.name)) continue;
      const path = join(dir, entry.name);
      const rel = relative(root, path).split(sep).join("/");
      if (ignorer.ignores(rel + (entry.isDirectory() ? "/" : ""))) continue;
      if (entry.isSymbolicLink()) { warnings.add("Symbolic links and junctions were skipped."); continue; }
      if (entry.isDirectory()) {
        const info = await lstat(path);
        if (info.isSymbolicLink() || await realpath(path) !== path) { warnings.add("Redirected directories were skipped."); continue; }
        await walk(path, depth + 1);
      } else if (entry.isFile()) {
        const isDoc = /^readme(?:\.[a-z]+)?$/i.test(entry.name);
        if (!sourceExtensions.has(extname(entry.name)) && !configNames.has(entry.name) && !isDoc) continue;
        const text = await readSafe(path, isDoc ? 32_768 : maxFileBytes);
        if (text === null) continue;
        const size = Buffer.byteLength(text);
        if (bytesScanned + size > maxBytes) { truncated = true; return; }
        bytesScanned += size;
        digest.update(rel).update("\0").update(text).update("\0");
        files.push({ path: rel, text });
      }
    }
  }
  await walk(root, 0);
  function add(kind: Evidence["kind"], path: string, line: number, title: string) {
    if (evidence.length >= 2000) { truncated = true; return undefined; }
    const id = `e${evidence.length + 1}`;
    evidence.push({ id, kind, path: clean(path, 500), line, title: clean(title) });
    return id;
  }
  const tech = new Map<string, { name: string; category: string; evidenceIds: string[] }>();
  function addTech(name: string, category: string, id: string | undefined) {
    if (!id) return;
    const existing = tech.get(name) ?? { name, category, evidenceIds: [] };
    if (existing.evidenceIds.length < 20) existing.evidenceIds.push(id);
    tech.set(name, existing);
  }
  for (const file of files) {
    const name = file.path.split("/").at(-1)!;
    if (name === "package.json") {
      try {
        const manifest = JSON.parse(file.text) as Record<string, unknown>;
        for (const section of [manifest.dependencies, manifest.devDependencies]) {
          if (!section || typeof section !== "object" || Array.isArray(section)) continue;
          for (const dependency of Object.keys(section).sort().slice(0, 500)) {
            if (!/^(@[a-z0-9._-]+\/)?[a-z0-9._-]+$/i.test(dependency)) continue;
            const line = file.text.slice(0, file.text.indexOf(`"${dependency}"`)).split("\n").length;
            const id = add("dependency", file.path, line, `Declared dependency: ${dependency}`);
            const known = technologies[dependency];
            if (known) addTech(...known, id);
          }
        }
        addTech("Node.js ecosystem", "runtime", add("configuration", file.path, 1, "Node package manifest"));
      } catch { warnings.add(`Invalid manifest: ${clean(file.path)}`); }
    } else if (/^readme/i.test(name)) {
      const lines = file.text.split(/\r?\n/);
      const index = lines.findIndex(line => line.trim().length > 15 && !/^(#|!\[|<|\[)/.test(line.trim()));
      if (index >= 0) add("document", file.path, index + 1, `Untrusted project description: ${lines[index]!.trim()}`);
    } else if (extname(name) === ".prisma") {
      for (const match of file.text.matchAll(/^\s*model\s+(\w+)\s*\{/gm)) add("data-model", file.path, file.text.slice(0, match.index).split("\n").length, `Prisma model: ${match[1]}`);
      for (const match of file.text.matchAll(/provider\s*=\s*"(postgresql|mysql|sqlite|mongodb|sqlserver|cockroachdb)"/g)) {
        addTech(match[1]!, "database", add("configuration", file.path, file.text.slice(0, match.index).split("\n").length, `Declared Prisma provider: ${match[1]}`));
      }
    } else if (name === "requirements.txt" || name === "pyproject.toml") {
      for (const framework of ["fastapi", "django", "flask"]) if (new RegExp(`\\b${framework}\\b`, "i").test(file.text)) {
        addTech(framework, "backend", add("dependency", file.path, 1, `Python dependency declaration: ${framework}`));
      }
    } else if (name === "Dockerfile" || name.endsWith("compose.yml")) {
      addTech("Docker", "infrastructure declaration", add("configuration", file.path, 1, "Container configuration exists; deployment is not verified"));
    }
    if (/\.[cm]?[jt]sx?$/.test(name)) {
      const ast = ts.createSourceFile(file.path, file.text, ts.ScriptTarget.Latest, true, name.endsWith("x") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
      const visit = (node: ts.Node) => {
        const line = () => ast.getLineAndCharacterOfPosition(node.getStart(ast)).line + 1;
        if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
          const module = node.moduleSpecifier.text;
          const known = technologies[module];
          if (known) addTech(...known, add("dependency", file.path, line(), `Imported library: ${module}`));
          if (module === "node:http" || module === "http") addTech("Node.js HTTP server", "backend", add("dependency", file.path, line(), "Imported Node HTTP module"));
        }
        if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === "fetch") {
          const arg = node.arguments[0];
          if (arg && ts.isStringLiteralLike(arg) && /^\/[\w/.:{}-]*$/.test(arg.text)) add("interaction", file.path, line(), `Client request to ${arg.text}`);
        }
        if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)) {
          const method = node.expression.name.text;
          const arg = node.arguments[0];
          const owner = node.expression.expression.getText(ast);
          if (/^(?:app|router|server|api)(?:\.[\w]+)?$/.test(owner) && ["get", "post", "put", "patch", "delete", "use"].includes(method)
            && arg && ts.isStringLiteralLike(arg) && /^\/[\w/.:*{}-]*$/.test(arg.text)) {
            add("route", file.path, ast.getLineAndCharacterOfPosition(node.getStart(ast)).line + 1, `${method.toUpperCase()} ${arg.text}`);
          }
          if (/^(?:prisma|db)\.\w+$/.test(owner) && ["create", "createMany", "findMany", "findUnique", "update", "updateMany", "delete", "deleteMany", "upsert"].includes(method)) {
            add("behavior", file.path, line(), `Database operation: ${owner}.${method}`);
          }
        }
        if ((ts.isFunctionDeclaration(node) || ts.isClassDeclaration(node)) && node.name && /(?:Screen|Page)$/.test(node.name.text)) {
          add("screen", file.path, ast.getLineAndCharacterOfPosition(node.getStart(ast)).line + 1, `Screen component: ${node.name.text}`);
        }
        if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && /(?:Screen|Page)$/.test(node.name.text)) add("screen", file.path, line(), `Screen component: ${node.name.text}`);
        if (ts.isJsxText(node)) {
          const value = node.text.replace(/\s+/g, " ").trim();
          if (value.length >= 3 && value.length <= 120) add("ui-label", file.path, line(), `Visible UI text candidate: ${value}`);
        }
        ts.forEachChild(node, visit);
      };
      visit(ast);
      if (/(?:^|\/)(?:app|pages)\//.test(file.path) && !/(?:_layout|layout|loading|error|not-found|api\/)/.test(file.path)) {
        add("screen", file.path, 1, `File-based screen candidate: ${file.path}`);
      }
    }
    if (name.endsWith(".html")) addTech("HTML", "frontend", add("configuration", file.path, 1, "Static HTML document"));
    if (name.endsWith(".css")) addTech("CSS", "frontend", add("configuration", file.path, 1, "Stylesheet"));
    if (name.endsWith(".html") || /\.[cm]?js$/.test(name)) for (const match of file.text.matchAll(/<h[123][^>]*>([^<\n]{3,100})/gi)) {
      add("ui-label", file.path, file.text.slice(0, match.index).split("\n").length, `Heading candidate: ${match[1]!.trim()}`);
    }
    if (name.endsWith(".py")) for (const match of file.text.matchAll(/@(?:app|router)\.(get|post|put|delete|patch)\(["'](\/[\w/{}:-]*)["']/g)) {
      add("route", file.path, file.text.slice(0, match.index).split("\n").length, `${match[1]!.toUpperCase()} ${match[2]}`);
    }
  }
  if (truncated) warnings.add("Analysis is incomplete because a scan budget was reached. Review excluded and oversized files manually.");
  warnings.add("Source declarations are evidence of code structure, not proof that a feature works or is deployed.");
  return { schemaVersion: 1, engine: "structural-v1", sourceDigest: digest.digest("hex"), filesScanned: files.length,
    bytesScanned, truncated, evidence, technologies: [...tech.values()].sort((a, b) => a.name.localeCompare(b.name)), warnings: [...warnings] };
}
