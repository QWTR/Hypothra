# Security policy

Hypothra v0.1.0 is experimental. Review it before exposing sensitive data.

## Current boundaries

- The simulation core does arithmetic only and rejects unknown or invalid inputs.
- The CLI reads a scenario only when you provide `--config`; JSON is parsed,
  never evaluated. `init` writes one file and refuses to overwrite it.
- `analyze` reads only an explicitly selected root manifest, up to 64 KiB.
  It does not recurse, read environment files, execute scripts, or send data.
- MCP exposes only `simulate_growth`, over local stdio. There is no HTTP listener,
  filesystem tool, authentication service, or arbitrary command facility.
- The runtime contains no telemetry or network calls. Dependencies are part of
  the trusted computing base; installation and audits contact the registry.
- Tool results are data. A future AI integration must not treat repository
  content as instructions or silently transmit source files to a model provider.

These are application boundaries, not an OS sandbox or a defense against a
malicious process modifying files concurrently. Do not run as administrator.
Do not expose this stdio process through an unauthenticated network bridge.
Use fixtures or copies for scanning until a broader scanner is reviewed.

## Reporting

Please use GitHub's private vulnerability reporting for this repository if that
feature is enabled. Otherwise open an issue containing only a request for a
private reporting channel, without exploit details, secrets, or private data.
Do not include credentials in public issues. No response-time guarantee is made
for this early project. Security fixes target the latest development version.
