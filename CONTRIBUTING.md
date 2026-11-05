# Contributing

Hypothra is an early open-source project. Small, reproducible changes are welcome.
Discuss changes to model assumptions or filesystem access before implementation.

```sh
npm ci --ignore-scripts
npm test
```

Use English for code, documentation, commits, and issues. Keep the simulation
core free of I/O, time, randomness, and network dependencies. Add meaningful
tests for mathematical behavior and security boundaries. Include an independently
computed example when changing a formula. Mark unfinished functionality clearly.

Before opening a pull request, explain the problem, resulting behavior, validation,
and limitations. Never commit credentials, private project data, dependency trees,
or generated build output. Lockfile changes belong with dependency changes.

All workspaces are private until a deliberate release process is implemented.
Do not publish packages or use a production project as a test fixture.

Contributions are provided under the repository's MIT license. Treat other
contributors respectfully and keep reviews focused on the work.
