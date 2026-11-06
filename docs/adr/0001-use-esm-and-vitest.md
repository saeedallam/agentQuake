# ADR 0001: Use ESM and Vitest

- Status: Accepted
- Date: 2026-10-28

## Context

agentquake is a new open-source project started in 2026. Its core
dependencies are moving to ES modules: NestJS 12 scaffolds ESM projects
by default (with Vitest), and Prisma 7 ships as ESM. The original plan
listed Jest as the test runner, which NestJS 12 only pairs with
CommonJS projects.

## Decision

- Use ES modules (ESM) for the whole codebase.
- Use Vitest as the test runner instead of Jest.

## Alternatives considered

- **CommonJS + Jest**: still supported and has more examples online,
  but goes against the direction of NestJS 12 and Prisma 7 and would
  require a migration later.

## Consequences

- Relative imports must use the `.js` extension
  (for example `./app.module.js`).
- Some older libraries or examples written for CommonJS may need
  adjustments.
- Vitest's API (`describe`, `it`, `expect`) is close to Jest's, so
  test-writing knowledge transfers directly.
- Contributors need Node.js 22.12+ and a recent npm. npm 10.9 crashed
  while resolving peer dependencies (`edgesOut` error); npm 11+ works.
