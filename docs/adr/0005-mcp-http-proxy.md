# ADR 0005: MCP proxy over Streamable HTTP

- Status: Accepted
- Date: 2026-11-05

## Context

Many agents call tools through MCP instead of plain HTTP. In MCP every
message is a JSON-RPC request sent to a single endpoint, so the URL path
says nothing about which tool is called, and a failure must reach the model
in a form it can read. MCP versions also differ in how they start a session
(`initialize`, session headers, stateless requests).

## Decision

- A second entry point, `/mcp-proxy/:runId/:tool`, forwards to the tool's
  `baseUrl`, which is the MCP server endpoint.
- Only `tools/call` requests are intercepted. Every other message, and every
  header, is forwarded untouched and is not traced. This keeps the proxy
  transparent to any MCP version and keeps the sequence numbers (and so the
  seeded faults) stable when the agent sends other messages.
- Fault targets reuse `path` for the MCP tool name, for example
  `target: { tool: weather, path: "get_*" }`. `planFaults` and the trace
  format are shared with the HTTP proxy. Because of this, scenario paths no
  longer have to start with `/`.
- When a fault responds, the proxy answers HTTP 200 with a JSON-RPC result
  marked `isError: true` and the request's `id` (`toolErrorResponse`). A tool
  error result reaches the model, which is the behavior we want to test. A
  protocol error or an HTTP error status would be handled by the client
  library instead.
- If the real server is down or slow, the proxy answers 502 or 504 like the
  HTTP proxy, because that is what the agent would see without agentquake.
- Faults are applied by `runFaults`, shared with the HTTP proxy.

## Consequences

- Server responses are read fully before they are returned. Servers that
  answer a request with a short SSE stream still work, but long-lived streams
  (for example server notifications on `GET`) are not supported yet.
- The stdio transport needs its own entry point (planned next).
