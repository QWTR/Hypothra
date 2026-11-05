# Architecture

This npm-workspaces monorepo uses ESM and TypeScript project references. `tsc -b`
builds packages in dependency order. Package exports resolve to compiled `dist`
files; run the build before invoking commands. Generated files are ignored.

## Dependency direction

- `simulation-core`: pure functions, data contracts, and numeric bounds; no imports.
- `project-scanner`: Node filesystem APIs; independent of the simulation engine.
- `cli`: depends on core and scanner; handles explicit file input and output.
- `mcp-server`: depends on core, the official MCP SDK, and Zod; no scanner access.
- `tests`: imports compiled packages and launches real child processes.

MCP validates a strict tool schema and the core independently validates all
scenario inputs. Numeric limits are shared to reduce schema drift. Tool annotations
describe read-only, idempotent local behavior; they are metadata, not a permission
system. The stdio entry point bounds incoming buffered messages to 64 KiB and
never writes diagnostic logs to stdout.

## Scanner boundary

The scanner resolves one explicitly selected root and inspects only its root
`package.json`. It rejects symlinked manifests, non-regular files, and manifests
over 64 KiB. It compares file identity before and after opening and requests
no-follow behavior where the OS supports it. It returns dependency names, not
scripts, arbitrary fields, or file contents. It makes no framework or capacity
claim. Hostile concurrent filesystem mutation is outside this scaffold's guarantees.

Future source scanning needs root containment, reparse-point handling on Windows,
ignore rules, byte/file/time budgets, parser isolation, secret filtering, and a
provenance trail. Agent access to scanning must be separately designed with
explicit roots and user consent; it is not exposed today.
