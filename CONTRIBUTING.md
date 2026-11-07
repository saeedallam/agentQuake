# Contributing to agentQuake

Thanks for wanting to help. agentQuake is young, so feedback, bug reports
and new fault ideas are as valuable as code.

## Ways to help

- **Tell us what broke your agent.** Open a
  [fault request](https://github.com/saeedallam/agentquake/issues/new?template=fault_request.yml)
  describing a tool failure you saw in production. Real failures decide
  which faults get built next.
- **Report a bug** with the
  [bug template](https://github.com/saeedallam/agentquake/issues/new?template=bug_report.yml).
  Include the seed from the report: with the same seed, agentQuake replays
  the same faults, so we can see exactly what you saw.
- **Pick a [good first issue](https://github.com/saeedallam/agentquake/labels/good%20first%20issue).**
  Comment on it first so two people do not work on the same thing.
- **Ask a question** in
  [Discussions](https://github.com/saeedallam/agentquake/discussions).

## Set up

Requirements: Node.js 22.12+ and npm 11+.

```bash
git clone https://github.com/saeedallam/agentquake.git
cd agentquake
npm ci
npm test -w agentquake
```

That is all you need for the library and the command line. The team
server (`packages/server`) also needs Docker; see [`AGENTS.md`](AGENTS.md).

## Adding a fault

Faults are plugins, so a new one should not need changes anywhere else.

1. Add `packages/agentquake/src/core/faults/<name>.fault.ts` with a class
   that implements `FaultPlugin` (`fault.ts`):
   - `apply()` runs **before** the real call. Return `{ kind: 'continue' }`,
     or `{ kind: 'respond', status, body }` to answer instead of the tool.
   - `corrupt()` is optional and runs **after** the real call, to change
     what the tool returned (see `empty-response.fault.ts`).
   - `validateConfig()` checks the fault's `config` with zod, so a bad
     scenario fails with a clear message.
2. Register it in `fault-registry.ts`.
3. Add `<name>.fault.spec.ts` next to it.
4. Document it in the fault tables in `README.md` and
   `packages/agentquake/README.md`.

Faults must stay deterministic: use the seeded random helpers, never
`Math.random()`. The same seed must always give the same faults.

## Before you open a pull request

```bash
npm run format:check
npm run lint
npm run typecheck
npm test
```

- Use [Conventional Commits](https://www.conventionalcommits.org):
  `feat:`, `fix:`, `docs:`, `test:`, `refactor:`, `chore:`.
- Keep pull requests focused on one change.
- Docs are in English. Prefer clear names over comments.

The full conventions, for humans and AI coding agents, are in
[`AGENTS.md`](AGENTS.md). Bigger design changes are recorded as ADRs in
[`docs/adr`](docs/adr); open a discussion first if you plan one.

By contributing, you agree that your contributions are licensed under the
[Apache-2.0 license](LICENSE).
