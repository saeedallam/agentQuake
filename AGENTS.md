# AGENTS.md

Instructions for AI coding agents (and humans) working on this repository.

## Project

agentQuake is a chaos testing proxy for AI agents. See `README.md` for
the goal and `docs/adr/` for the decisions behind the setup.

## Setup

```bash
cp packages/server/.env.example packages/server/.env
npm ci               # also builds the core and runs `prisma generate`
docker compose up -d # PostgreSQL on 127.0.0.1:5433
npm run db:migrate
npm run db:seed      # optional demo data
```

Use `npm ci`, not `npm install`, to install or to sync after a pull: it
installs exactly what `package-lock.json` says and never rewrites it. Use
`npm install <package>` only to add or upgrade a dependency, and commit the
lock file with that change.

## Layout

npm workspaces (ADR 0006):

- `packages/agentquake`: the package that will be published. `src/core`
  holds faults, fault planning, scenarios, validation helpers, trace
  policy, MCP message helpers and the stdio `ServerBridge`, exported as
  `agentquake/core`.
- `packages/server`: the private NestJS server. It imports the core only
  through `agentquake/core`, like any user of the package.

Run scripts from the root. `-w agentquake` or `-w @agentquake/server`
targets one package.

## Conventions

- **ESM only.** Relative imports must end in `.js`, even from `.ts` files
  (for example `import { AppModule } from './app.module.js'`).
- **Prisma is pinned to version 7.** Never install `prisma` or
  `@prisma/client` without an explicit major version, and do not follow
  the CLI's "Update available" banner to Prisma 8. See ADR 0002.
- The Prisma client is generated into `packages/server/src/generated/` and
  is not committed. Import it from `src/generated/prisma/client.js`.
- Database changes go through `packages/server/prisma/schema.prisma` and a
  new migration
  (`npm run db:migrate -- --name <change>`). Never edit an applied
  migration.
- **`packages/agentquake` must not import NestJS, Prisma, `node:http` or
  anything outside itself.** The linter enforces this.
- Faults and evaluators are plugins (Strategy pattern). A fault is a class
  implementing `FaultPlugin` in `packages/agentquake/src/core/faults`, registered in
  `FaultRegistry`. Adding one must not require changes to `ProxyService`
  or the database schema. That is why `fault_type` is a string column.
- Keep rules in pure functions in the core. See ADR 0003, 0004 and 0006.
- Validate input with zod (`packages/server/src/common/validation.ts`).
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
