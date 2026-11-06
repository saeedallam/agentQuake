# ADR 0006: Three ways to use agentquake, built on a shared core

- Status: Accepted
- Date: 2026-11-06
- Changes: ADR 0003 (interfaces for infrastructure), ADR 0005 (stdio plan)

## Context

Research in November 2026 found several tools close to this project,
most of them released this year. AgentBreak is the closest: a proxy with
YAML scenarios, MCP support, a scorecard and CI support. Almost all of them
are Python and install with one command.

Trying this project today takes about 20 minutes: Docker, PostgreSQL,
migrations and a running server. The other tools take about two. The
server is the right shape for teams, but it is the wrong first step for a
developer who wants to know what their agent does when a tool fails.

There is no mature tool for TypeScript developers who build agents. Most of
them call tools as functions (Vercel AI SDK, OpenAI SDK, LangChain.js) or
through an MCP client, and test with Vitest or Jest.

The name is crowded: `agent-chaos` is taken on npm, and `agent-chaos`,
`agentchaos-core` and a Python CLI called `agentchaos` exist on PyPI.

The project had no license, so it could not be published as open source.

## Decision

### Name and license

- The project is renamed **agentquake**. The npm package and the CLI use
  this name. It was free on npm and PyPI, with no known project on GitHub.
- The license is **Apache-2.0**, which adds an explicit patent grant to
  the freedoms of MIT.

### Three levels of use

| Level | How                                         | Needs              | Traces            |
| ----- | ------------------------------------------- | ------------------ | ----------------- |
| 1     | Library in tests (`npm i -D agentquake`)    | Nothing            | In memory         |
| 2     | CLI proxy (`npx agentquake proxy`, `stdio`) | Node.js            | JSONL file        |
| 3     | Server (NestJS, PostgreSQL), dashboard later | Docker, PostgreSQL | PostgreSQL        |

The goal is a first result in under three minutes, through level 1 or 2.

### Packages

npm workspaces with two packages:

- `packages/agentquake`: published. Contains the core, the library and
  the CLI.
- `packages/server`: private. The current NestJS app. It depends on
  `agentquake`.

The core is a folder (`src/core`) inside `agentquake`, not a separate
package. A lint rule stops it from importing NestJS, Prisma, Node's HTTP
modules or anything outside the core. It holds scenario parsing, fault
planning, seeded randomness, fault plugins, trace policy, message helpers
and, later, evaluation. It can become its own package when someone needs it
alone.

### Transport-neutral faults

A fault plugin decides **what** happens (`continue`, or fail with a status
and a message). Each adapter decides **how** that looks to the agent:

| Adapter         | A failing fault becomes                     |
| --------------- | ------------------------------------------- |
| HTTP            | An HTTP error status                        |
| MCP             | A tool result with `isError: true`          |
| Function tool   | A thrown error                              |

This is the pattern `toolErrorResponse` already uses for MCP.

### Ports and adapters for storage

Trace storage is a port, `TraceStore`, with `nextSequence(runId)` and
`record(trace)`. It has three adapters: memory (level 1), JSONL file
(level 2) and PostgreSQL (level 3).

The store owns sequence numbers, because seeded replay depends on them. The
current `count + 1` gives two concurrent calls the same number; each
adapter must hand out unique, ordered numbers.

This is the second implementation ADR 0003 waited for, so the interface is
introduced now. Other infrastructure stays without interfaces until it
needs a second implementation.

### Library API first

The library API is written before the code: the README example (about ten
lines) and a failing test that uses it. It must:

- wrap tool functions, and HTTP `fetch` for tools called over HTTP;
- wrap the agent's whole run, so the result can be checked.

Seeing the agent's final answer is what makes the planned "false success"
check possible (the agent says it succeeded after a tool failed). Only
level 1 sees that answer, so the check starts there.

### stdio

`ServerBridge`, which matches server replies to requests by JSON-RPC `id`,
is finished now and moves to the core. The process that starts the real
MCP server is built in level 2 and applies faults in process, without the
server. The plan in ADR 0005 to route stdio through `/mcp-proxy` is
dropped.

### Evaluation and queues

Phase 3 (evaluators, score, report) is built in the core, so it works in
all three levels. BullMQ is removed from the plan. If the server needs a
queue later, that gets its own ADR.

## Order of work

1. Finish `ServerBridge` (`send`, `receive`).
2. This ADR.
3. Write the library API on paper: README example and a failing test.
4. Split into workspaces and move the core, keeping every test green.
5. Build the library and publish `agentquake@0.1.0`.
6. Build the CLI, including the stdio wrapper.
7. Phase 3 in the core.

## Alternatives considered

- **Keep only the server, with a one-command Docker setup**: shorter than
  today, but still Docker and a database, and no way to run inside a test.
- **Three published packages** (`core`, `agentquake`, `server`): cleaner
  boundaries, but three versions and changelogs to keep in sync before
  anyone uses the core alone.
- **Rewrite in Python** to meet most users where they are: gives up the
  TypeScript gap, which is the clearest opening.
- **Keep the name `agentchaos`**: free on npm, but too close to existing
  tools to be found or remembered.

## Consequences

- The server keeps working through the split. Every move is a refactor
  with green unit and e2e tests.
- The Prisma pin (ADR 0002) only applies to `packages/server`.
- The GitHub repository and the docs will be renamed to agentquake when
  the packages are split. GitHub redirects the old URL.
- `AGENTS.md` will describe the workspaces and the core import rule.
- The same trace shape is used by all three stores, so a JSONL file from
  level 2 can be loaded into the server later.
- ADR 0003's layers stay inside the server; ADR 0005 still describes the
  HTTP MCP proxy.
