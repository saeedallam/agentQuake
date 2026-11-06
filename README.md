<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="assets/logo-dark.png">
    <img src="assets/logo-light.png" width="160" alt="agentQuake logo: a robot head whose face is a seismograph line">
  </picture>
</p>

<h1 align="center">agentQuake</h1>

<p align="center"><b>Chaos testing for AI agents.</b><br>
Break your agent before production does.</p>

<p align="center">
  <a href="https://www.npmjs.com/package/agentquake"><img src="https://img.shields.io/npm/v/agentquake?color=FF5A1F&amp;label=npm" alt="npm version"></a>
  <a href="https://github.com/saeedallam/agentquake/actions/workflows/ci.yml"><img src="https://github.com/saeedallam/agentquake/actions/workflows/ci.yml/badge.svg" alt="CI"></a>
  <img src="https://img.shields.io/badge/status-early-FF5A1F" alt="Status: early">
  <img src="https://img.shields.io/badge/node-22.12%2B-5FA04E?logo=nodedotjs&amp;logoColor=white" alt="Node.js 22.12+">
  <img src="https://img.shields.io/badge/TypeScript-6-3178C6?logo=typescript&amp;logoColor=white" alt="TypeScript 6">
  <img src="https://img.shields.io/badge/NestJS-12-E0234E?logo=nestjs&amp;logoColor=white" alt="NestJS 12">
  <img src="https://img.shields.io/badge/PostgreSQL-18-4169E1?logo=postgresql&amp;logoColor=white" alt="PostgreSQL 18">
</p>

<p align="center">
  <a href="#quick-start">Quick start</a> ·
  <a href="#scenarios">Scenarios</a> ·
  <a href="#mcp-tools">MCP</a> ·
  <a href="#roadmap">Roadmap</a> ·
  <a href="docs/adr">Design decisions</a>
</p>

---

agentQuake makes your agent's tools fail on purpose (slow answers, errors,
timeouts) and records what the agent does about it, so you can see whether
it copes, retries, loops or claims a success that never happened.

Start inside your tests, with no server and no database:

```bash
npm i -D agentquake
```

```ts
import { quake } from 'agentquake';

it('survives a flaky weather API', async () => {
  const run = quake({ preset: 'flaky', seed: 42 });

  await run.agent(() =>
    weatherAgent('What is the weather in Cairo?', {
      getWeather: run.tool('getWeather', getWeather),
    }),
  );

  expect(run.report().falseSuccess).toBe(false);
});
```

More in the [package README](packages/agentquake/README.md). For tools you do
not call from code (HTTP APIs and MCP servers), agentQuake also runs as a
proxy, described below.

> [!NOTE]
> `agentquake@0.1.0` (the library) is published. The proxy for HTTP and MCP
> works through the team server below; a CLI that needs no server is next.
> The API may still change before 1.0.

## Why

Agents look great in demos, where every tool answers instantly and
correctly. In production, APIs slow down, rate limit and time out. When that
happens, agents fail in ways that are hard to spot:

- **They loop**, calling the same failing tool again and again while the
  bill grows.
- **They give up** on the first timeout, even when one retry would have
  worked.
- **They claim success** after a call failed, and the user never finds out.

agentQuake answers the question nobody tests: what does your agent do when
its tools fail?

## How it works

```
Agent  ──>  agentQuake  ──>  Real tool
              │
              ├─ plans faults from the scenario (seeded, repeatable)
              ├─ applies them: delay, error status, or timeout
              └─ records a trace for every call, secrets redacted
```

Point your agent's tool base URL at the proxy instead of the real tool:

```
before:  https://api.weather.com/forecast
after:   http://localhost:3000/proxy/<runId>/weather/forecast
```

Nothing else in the agent changes.

## Quick start

Requirements: Node.js 22.12+, npm 11+ (npm 10.9 crashes while installing, see
[ADR 0001](docs/adr/0001-use-esm-and-vitest.md)), Docker with Compose.

```bash
git clone https://github.com/saeedallam/agentquake.git
cd agentquake
cp packages/server/.env.example packages/server/.env
npm install                # also builds the core and generates the Prisma client
docker compose up -d       # PostgreSQL on 127.0.0.1:5433
npm run db:migrate
npm run start:dev          # API on http://localhost:3000
```

## Usage

```bash
# 1. A project and the tools your agent calls
curl -X PUT localhost:3000/projects/my-agent \
  -H 'content-type: application/json' -d '{"name":"My agent"}'
curl -X PUT localhost:3000/projects/my-agent/tools/weather \
  -H 'content-type: application/json' \
  -d '{"baseUrl":"https://api.weather.com"}'

# 2. A scenario
curl -X POST localhost:3000/projects/my-agent/scenarios \
  -H 'content-type: text/yaml' --data-binary @flaky-weather.yaml

# 3. A run (returns its id and proxy URL)
curl -X POST localhost:3000/projects/my-agent/scenarios/flaky-weather/runs

# 4. Point the agent at http://localhost:3000/proxy/<runId>/weather and run it

# 5. Read what happened, then close the run
curl localhost:3000/runs/<runId>/traces
curl -X POST localhost:3000/runs/<runId>/complete
```

### Demo data

`npm run db:seed` creates a `demo` project with four running runs against a
fake upstream on `http://localhost:5000`: `...0001` (no faults), `...0002`
(latency), `...0003` (http_error) and `...0004` (timeout). Seeding resets
their traces, so the fault pattern is the same every time.

## Scenarios

A scenario is a YAML file that says which faults to inject, where, and how
often.

```yaml
version: 1
name: flaky-weather
seed: 42 # same seed = same faults on the same requests

faults:
  - id: slow-forecast
    type: latency
    target: { tool: weather, path: '/forecast*' } # * matches any ending
    probability: 0.5 # 0 = never, 1 = always (default 1)
    config: { delayMs: 2000 }

  - id: rate-limited
    type: http_error
    target: { tool: weather } # no path = every path of this tool
    probability: 0.2
    config: { status: 429 }
```

Whether a fault fires is decided by the run's seed, the request number and
the fault id, so a run can be replayed exactly.

Invalid scenarios are rejected with every problem listed:

```json
{
  "error": "INVALID_INPUT",
  "issues": [
    {
      "path": "faults.0.probability",
      "message": "Too big: expected number to be <=1"
    }
  ]
}
```

### Faults

| Type         | What happens                              | Config            |
| ------------ | ----------------------------------------- | ----------------- |
| `latency`    | Waits, then calls the real tool           | `delayMs` (1000)  |
| `http_error` | Answers with an error, tool is not called | `status` (503)    |
| `timeout`    | Waits, then answers 504, tool not called  | `afterMs` (30000) |

Faults are plugins, so a new one can be added without touching the proxy or
the database schema. See [Contributing](#contributing).

## MCP tools

For an MCP server over HTTP, register the server endpoint as the tool's
`baseUrl` and point the agent at `/mcp-proxy/<runId>/<tool>`:

```
before:  https://weather.example.com/mcp
after:   http://localhost:3000/mcp-proxy/<runId>/weather
```

Only `tools/call` requests can get faults; everything else passes through
untouched. Target a tool by its MCP name with `path`:

```yaml
target: { tool: weather, path: 'get_*' }
```

When a fault fires, the agent receives a normal MCP tool result with
`isError: true`, so the model sees that the tool failed. See
[ADR 0005](docs/adr/0005-mcp-http-proxy.md).

## Roadmap

- [x] **Phase 1: HTTP proxy.** Seeded faults (latency, HTTP errors,
      timeouts), YAML scenarios, traces with secrets redacted
- [ ] **Phase 2: MCP.** Streamable HTTP proxy is done; the stdio bridge is
      built and will ship with the CLI
- [x] **Library (0.1.0).** `npm i -D agentquake`, wrap your tools inside a
      Vitest or Jest test, no server needed. See
      [the package README](packages/agentquake/README.md)
- [ ] **CLI.** `npx agentquake proxy` and `npx agentquake stdio`, traces in
      a JSONL file
- [ ] **Scoring.** Evaluators for loops, retries, cost, false success and
      prompt injection, and a report with a score, in all three levels
- [ ] **Team server.** This NestJS server with PostgreSQL, a GitHub Action
      and a dashboard

The plan is explained in [ADR 0006](docs/adr/0006-three-levels-shared-core.md).

## Development

| Script               | What it does                               |
| -------------------- | ------------------------------------------ |
| `npm run start:dev`  | Start the app and restart on file changes  |
| `npm test`           | Unit tests                                 |
| `npm run test:e2e`   | End-to-end tests (needs the database)      |
| `npm run lint`       | Lint (oxlint)                              |
| `npm run typecheck`  | Type check                                 |
| `npm run format`     | Format (Prettier)                          |
| `npm run db:migrate` | Create and apply migrations in development |
| `npm run db:deploy`  | Apply migrations (CI and production)       |
| `npm run db:seed`    | Load the demo data                         |

The repository is an npm workspace with two packages:

| Package               | What it is                                        |
| --------------------- | ------------------------------------------------- |
| `packages/agentquake` | The published package. `src/core` holds the logic |
| `packages/server`     | This NestJS server with PostgreSQL. Private       |

The scripts above run from the repository root. To run one package only, use
`-w`, for example `npm test -w agentquake`. The server uses the built core
(`dist`), so while you change the core and run the server at the same time,
keep `npm run dev -w agentquake` running in a second terminal.

CI runs all checks and the end-to-end tests against PostgreSQL on every pull
request.

### Architecture

Decisions are recorded in [`docs/adr`](docs/adr). In short: the controller
translates HTTP, `ProxyService` orchestrates, fault planning and trace
redaction are pure functions, and database and network access live in small
infrastructure classes.

## Contributing

Conventions for humans and AI coding agents are in
[`AGENTS.md`](AGENTS.md). Commits follow
[Conventional Commits](https://www.conventionalcommits.org), and every pull
request must pass the checks listed there.

## License

[Apache-2.0](LICENSE)
