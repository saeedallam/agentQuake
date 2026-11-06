# AGENTS.md

Instructions for AI coding agents (and humans) working on this repository.

## Project

agentQuake is a chaos testing proxy for AI agents. See `README.md` for
the goal and `docs/adr/` for the decisions behind the setup.

## Setup

```bash
npm install          # also runs `prisma generate`
cp .env.example .env
docker compose up -d # PostgreSQL on 127.0.0.1:5433
npm run db:migrate
npm run db:seed      # optional demo data
```

## Conventions

- **ESM only.** Relative imports must end in `.js`, even from `.ts` files
  (for example `import { AppModule } from './app.module.js'`).
- **Prisma is pinned to version 7.** Never install `prisma` or
  `@prisma/client` without an explicit major version, and do not follow
  the CLI's "Update available" banner to Prisma 8. See ADR 0002.
- The Prisma client is generated into `src/generated/` and is not
  committed. Import it from `src/generated/prisma/client.js`.
- Database changes go through `prisma/schema.prisma` and a new migration
  (`npm run db:migrate -- --name <change>`). Never edit an applied
  migration.
- **`src/core` is the part that will be published** (ADR 0006): faults,
  fault planning, scenarios, validation helpers, trace policy, MCP message
  helpers and the stdio `ServerBridge`. It must not import NestJS, Prisma,
  `node:http` or anything outside `src/core`. The linter enforces this.
  Everything else in `src` is the NestJS server.
- Faults and evaluators are plugins (Strategy pattern). A fault is a class
  implementing `FaultPlugin` in `src/core/faults`, registered in
  `FaultRegistry`. Adding one must not require changes to `ProxyService`
  or the database schema. That is why `fault_type` is a string column.
- Keep rules in pure functions in `src/core`. See ADR 0003, 0004 and 0006.
- Validate input with zod (`src/common/validation.ts`).
- Never store secrets. Redact `Authorization`, cookies and API keys from
  traces before writing them.
- No floating promises: always `await` or explicitly handle a promise.
  The linter enforces this.
- Prefer clear names over code comments. Docs are in English.

## Checks before committing

```bash
npm run format:check
npm run lint
npm run typecheck
npm test
npm run test:e2e   # needs the database
```

## Commits

Use Conventional Commits: `feat:`, `fix:`, `docs:`, `chore:`, `test:`,
`refactor:`.
