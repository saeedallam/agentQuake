# Weather agent example

A real [Vercel AI SDK](https://ai-sdk.dev) agent with one tool,
`getForecast`, tested with agentquake in two versions:

- **naive**: passes whatever the tool returns to the model.
- **careful**: checks the answer with zod (right shape, right city, right
  number of days), retries once, and otherwise tells the model the tool
  failed.

```bash
# from the repository root
npm ci
npm run example                              # the demo below
npm test -w @agentquake/example-weather-agent  # the same cases as tests
```

Without an API key, a scripted model stands in for the LLM, so it runs for
free and gives the same output every time. Like many real models, it
reports tool errors honestly but writes whatever data it gets into the
answer. With `ANTHROPIC_API_KEY` set, the demo uses Claude instead
(`ANTHROPIC_MODEL` picks the model); the tests always use the scripted model.

```
== outage (every call fails)
  naive    Sorry, I could not get the forecast for Cairo right now.
  careful  Sorry, I could not get the forecast for Cairo right now.

== empty answer (200, no data)
  naive    Forecast for undefined: no data.
           -> LEAKED GARBAGE, 1 corrupted call(s)
  careful  Sorry, I could not get the forecast for Cairo right now.

== truncated answer (200, half the data)
  naive    Forecast for Ca: 31°C, 30°C.
           -> 1 corrupted call(s)
  careful  Sorry, I could not get the forecast for Cairo right now.
```

What it shows:

- A visible error (an outage) is easy: the SDK passes it to the model and
  both agents admit it.
- A silent fault is the trap. The naive agent answers confidently with an
  empty or half forecast. agentquake flags the empty one (`leakedGarbage`);
  the truncated one only shows up as a corrupted call, because the answer
  looks normal. Checking tool answers in the tool itself is what saves the
  careful agent.

## Files

| File                    | What it is                                         |
| ----------------------- | -------------------------------------------------- |
| `src/forecast-api.ts`   | The tool's real backend (a local stand-in)         |
| `src/agents.ts`         | The naive and the careful agent                    |
| `src/scripted-model.ts` | The model used without an API key and in the tests |
| `src/weather.test.ts`   | The tests                                          |
| `src/demo.ts`           | `npm run example`                                  |
