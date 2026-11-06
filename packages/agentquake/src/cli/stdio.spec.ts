import { PassThrough } from 'node:stream';
import { fileURLToPath } from 'node:url';
import { quake } from '../library/quake.js';
import type { QuakeOptions } from '../library/resolve-rules.js';
import { runStdio } from './stdio.js';

const FAKE_SERVER = fileURLToPath(
  new URL('./fixtures/fake-mcp-server.mjs', import.meta.url),
);

function startBridge(options: QuakeOptions = {}) {
  const run = quake({ seed: 1, ...options });
  const agentInput = new PassThrough();
  const agentOutput = new PassThrough();
  const received: unknown[] = [];
  let buffered = '';
  agentOutput.on('data', (chunk: Buffer) => {
    buffered += chunk.toString('utf8');
    const lines = buffered.split('\n');
    buffered = lines.pop() ?? '';
    for (const line of lines) {
      received.push(JSON.parse(line));
    }
  });

  const exited = runStdio({
    run,
    command: process.execPath,
    args: [FAKE_SERVER],
    agentInput,
    agentOutput,
  });

  const send = (message: unknown) =>
    agentInput.write(`${JSON.stringify(message)}\n`);
  const waitFor = async (predicate: (message: any) => boolean) => {
    for (let attempt = 0; attempt < 100; attempt += 1) {
      const found = received.find(predicate);
      if (found) {
        return found as any;
      }
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    throw new Error(`No matching message in ${JSON.stringify(received)}`);
  };
  const stop = async () => {
    agentInput.end();
    return exited;
  };

  return { run, send, waitFor, stop };
}

function forecastCall(id: number, name = 'get_forecast') {
  return {
    jsonrpc: '2.0',
    id,
    method: 'tools/call',
    params: { name, arguments: { city: 'Cairo' } },
  };
}

describe('runStdio', () => {
  it('passes messages through and records tool calls', async () => {
    const bridge = startBridge();

    bridge.send({ jsonrpc: '2.0', id: 1, method: 'tools/list' });
    bridge.send(forecastCall(2));

    await expect(
      bridge.waitFor((message) => message.id === 1),
    ).resolves.toMatchObject({ result: { tools: [{ name: 'get_forecast' }] } });
    await expect(
      bridge.waitFor((message) => message.id === 2),
    ).resolves.toMatchObject({
      result: { content: [{ text: 'Sunny in Cairo' }] },
    });
    expect(bridge.run.report().calls).toEqual([
      expect.objectContaining({
        sequence: 1,
        tool: 'get_forecast',
        args: [{ city: 'Cairo' }],
        ok: true,
      }),
    ]);

    await expect(bridge.stop()).resolves.toBe(0);
  });

  it('answers a failed tool result with the same id when a fault fires', async () => {
    const bridge = startBridge({ preset: 'outage' });

    bridge.send(forecastCall(7));

    await expect(
      bridge.waitFor((message) => message.id === 7),
    ).resolves.toMatchObject({ result: { isError: true } });
    expect(bridge.run.report()).toMatchObject({
      injectedFaults: 1,
      failedTools: ['get_forecast'],
    });
    await bridge.stop();
  });

  it('records a tool error reported by the server as a failed call', async () => {
    const bridge = startBridge();

    bridge.send(forecastCall(3, 'broken_tool'));

    await expect(
      bridge.waitFor((message) => message.id === 3),
    ).resolves.toMatchObject({ result: { isError: true } });
    expect(bridge.run.report().failedTools).toEqual(['broken_tool']);
    await bridge.stop();
  });

  it('passes messages that the server starts on its own to the agent', async () => {
    const bridge = startBridge();

    await expect(
      bridge.waitFor((message) => message.method === 'notifications/hello'),
    ).resolves.toBeDefined();
    await bridge.stop();
  });
});
