import { build } from "esbuild";
import { chmod, copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const repo = resolve(fileURLToPath(new URL("..", import.meta.url)));
const staging = join(repo, "work", "distribution");
const releases = join(repo, "work", "releases");
await mkdir(staging, { recursive: true });
await mkdir(releases, { recursive: true });
const external = ["cheerio", "playwright", "typescript-ast", "ignore", "zod", "@modelcontextprotocol/server", "@modelcontextprotocol/server/*"];
for (const [entry, output] of [["packages/cli/src/index.ts", "cli.mjs"], ["packages/mcp-server/src/index.ts", "mcp.mjs"]]) {
  await build({ entryPoints: [join(repo, entry)], outfile: join(staging, "dist", output), bundle: true,
    format: "esm", platform: "node", target: "node22", external, legalComments: "eof" });
  await chmod(join(staging, "dist", output), 0o755);
}
const source = JSON.parse(await readFile(join(repo, "package.json"), "utf8"));
await writeFile(join(staging, "package.json"), JSON.stringify({ name: "hypothra", version: source.version, private: true,
  description: "Understand a software product and run evidence-aware launch experiments", license: "MIT", type: "module",
  engines: { node: ">=22" }, bin: { hypothra: "dist/cli.mjs", "hypothra-mcp": "dist/mcp.mjs" },
  files: ["dist", "README.md", "LICENSE", "SECURITY.md"],
  dependencies: { "cheerio": "1.2.0", "@modelcontextprotocol/server": "2.4.0", "ignore": "7.0.14", "playwright": "1.64.1", "typescript-ast": "npm:typescript@5.9.3", "zod": "4.6.7" },
}, null, 2) + "\n");
for (const name of ["README.md", "LICENSE", "SECURITY.md"]) await copyFile(join(repo, name), join(staging, name));
if (!process.env.npm_execpath) throw new Error("Run through npm run package.");
const result = spawnSync(process.execPath, [process.env.npm_execpath, "pack", "--ignore-scripts", "--pack-destination", releases, "--json"], { cwd: staging, encoding: "utf8", windowsHide: true });
if (result.status !== 0) throw new Error("Package creation failed: " + result.stderr);
const [artifact] = JSON.parse(result.stdout);
console.log(JSON.stringify({ file: join(releases, artifact.filename), bytes: artifact.size, sha512: artifact.integrity,
  usage: "Install this explicit local .tgz with npm install --save-dev <path>. Nothing was published to npm." }, null, 2));
