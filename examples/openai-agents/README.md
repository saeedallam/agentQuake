# OpenAI Agents SDK example

This example wraps an inventory lookup with agentQuake and calls it through
the OpenAI Agents SDK. The lookup uses local data, and the SDK uses a scripted
model with tracing disabled. No API key or external service is required.

From the repository root, run:

```sh
npm ci
npm test -w @agentquake/example-openai-agents
```

Both variants return the quantity when the lookup succeeds. With a fixed seed
and the `silent` preset, the tool truncates the requested SKU from `tea-01` to
`tea`. The naive variant reports stock for the truncated SKU. The careful
variant checks the response shape and SKU and reports that stock is unavailable.
