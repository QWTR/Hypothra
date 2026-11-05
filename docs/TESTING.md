# Testing Hypothra safely

## Current automated checks

Run `npm ci --ignore-scripts`, `npm run build`, then `npm test`. The test command
also builds, so it is safe as the normal development check. Tests use Node's
built-in runner against compiled code.

1. **Engine:** compare two months against an independently hand-calculated case;
   check month-one operation order, deterministic repetition, input immutability,
   empty population, total churn, upper bounds, and invalid inputs.
2. **CLI:** launch actual Node processes; check JSON output against the engine,
   initialize a temporary folder with spaces, refuse overwrites, and reject
   malformed, oversized, missing, or invalid files and unknown arguments.
3. **MCP:** launch the actual stdio entry point with the official SDK client;
   connect, discover the tool, invoke it twice, compare text and structured
   results to the core, reject invalid inputs and nonexistent scanner tools,
   and close the process. No AI host or paid model is needed for this layer.
4. **Scanner scaffold:** create disposable manifests and secret sentinels; verify
   dependency-only output, no arbitrary content exposure, and rejection of bad
   files. File-symlink tests skip explicitly when OS privileges prevent creating
   the fixture. The Linux CI job can run that case without Windows privileges.

Fixtures live in task-specific OS temporary directories and are removed after
each test. Do not point tests at production repositories, databases, or services.
CI runs the same commands on Windows and Linux with Node 22 and 24.

## Manual CLI check

```sh
npm exec -- hypothra simulate --config examples/growth.scenario.json
npm exec -- hypothra analyze packages/cli
```

Month one must report 1,069 active users, 1,069 USD revenue, 806.90 USD costs,
and 262.10 USD profit. JSON numbers do not preserve trailing zeroes.

## Next: a real MCP host

Use the local configuration in the README. Confirm that the host lists only
`simulate_growth`, ask it to run the example's explicit assumptions, inspect the
actual tool invocation, and compare the result to CLI output. Confirm that the
host distinguishes supplied assumptions from measurements. Automated protocol
tests do not establish that any specific host is configured or working.

Do not grant general shell or filesystem access to test this tool. The MCP server
does not need access to a project, a secret, a cloud account, or an API key.

## Later: a real project scanner

Start with generated fixtures, then a disposable copy of a consenting project.
Include `.env`, nested dependencies, ignored files, symlinks, Windows junctions,
oversized files, binary files, misleading scripts, and prompt-injection strings.
Prove that reads stay within the allowed root and outputs exclude secrets before
connecting the scanner to an agent. Separate observed code facts from inference.
Never run discovered install scripts, tests, or application code automatically.

## Later: infrastructure experiments

Use a throwaway local service with synthetic data and fixed CPU/memory budgets.
Require explicit target authorization and request/time/concurrency caps, then
record latency, throughput, errors, and environment. Do not infer a production
user capacity from dependencies or business-model arithmetic. Production load
tests and access changes require a separate, explicit request.
