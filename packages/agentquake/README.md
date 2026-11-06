<p align="center">
  <img src="https://raw.githubusercontent.com/saeedallam/agentQuake/main/assets/logo-light.png" width="120" alt="agentQuake logo">
</p>

<h1 align="center">agentquake</h1>

<p align="center"><b>Chaos testing for AI agents, inside your tests.</b><br>
Make your agent's tools fail and see whether it copes, retries or lies about success.</p>

```bash
npm i -D agentquake
```

## Ten lines

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

Your agent and your tools do not change. `run.tool` wraps a tool function:
before each call it decides, from the seed, whether to inject a fault. A
failing fault throws a `ToolFailure` (`Tool getWeather failed with HTTP 503`)
instead of calling the real tool. `run.agent` keeps the agent's final answer,
and `run.report()` tells you what happened.

Works with Vitest, Jest or any test runner, with no server and no database.
The package is ESM only and needs Node.js 22.12 or newer.

## Presets

| Preset         | What happens to every wrapped tool |
| -------------- | ---------------------------------- |
| `flaky`        | Fails with 503 in 30% of calls     |
| `rate-limited` | Fails with 429 in 50% of calls     |
| `slow`         | Waits 1 second in 50% of calls     |
| `outage`       | Fails with 503 on every call       |

## Your own faults

```ts
const run = quake({
  seed: 7,
  faults: [
    {
      id: 'email-down',
      type: 'http_error', // or 'latency', 'timeout'
      target: { tool: 'sendEmail' },
      probability: 0.5,
      config: { status: 503 },
    },
  ],
});
```

Invalid options throw a `QuakeConfigError` that lists every problem.

## The report

```ts
const report = run.report();

report.seed; // pass it to quake({ seed }) to replay the same faults
report.calls; // every tool call: arguments, faults, result or error
report.injectedFaults; // how many faults fired
report.failedTools; // tools whose last call failed
report.falseSuccess; // the agent claimed success after a tool failed
```

`falseSuccess` is `true` when a tool's last call failed and the agent's
answer does not admit it (words such as "sorry", "unable", "failed",
"unavailable"). It is a heuristic; pass your own check when you know your
agent's output:

```ts
run.report({ admitsFailure: (answer) => answer.status === 'error' });
```

## Same seed, same faults

Whether a fault fires depends only on the seed, the call number and the
fault id. A failing test prints its seed in the report, so you can replay it
exactly.

## More

The project also has a proxy for HTTP and MCP tools and a server for teams.
See the [repository](https://github.com/saeedallam/agentQuake).

## License

Apache-2.0
