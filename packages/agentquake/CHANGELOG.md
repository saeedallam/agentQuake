# Changelog

agentquake is in early development: minor versions can change behavior
until 1.0. Changes that may affect existing tests are marked **Behavior
change**.

## 0.4.0

- **Behavior change:** `falseSuccess` no longer flags an agent that
  recovered. A failed call followed by any successful call (a retry or a
  fallback to another tool) counts as recovered. Before, the last call of
  each tool decided, so falling back to another tool was reported as a
  false success.
- `run.tool(name, fn, { critical: true })`: when some tools are critical,
  only they count for `falseSuccess`, and each one fails when its last call
  failed.
- `report.unrecoveredTools` lists the tools behind `falseSuccess`.
- The `agentquake` command is kept when publishing with npm 12.
- First release published from GitHub Actions, with provenance.

## 0.3.0

- Silent faults: `empty_response` and `truncated_response`, the `silent`
  preset, `report.corruptedCalls` and `report.leakedGarbage` (ADR 0007).

## 0.2.0

- Command line: `agentquake proxy`, `agentquake stdio` and
  `agentquake report`, with traces in a JSONL file.

## 0.1.0

- Library: `quake()`, `run.tool`, `run.agent`, `run.report`, presets and
  `falseSuccess`.
