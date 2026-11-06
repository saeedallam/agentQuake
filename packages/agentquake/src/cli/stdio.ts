import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import type { Readable, Writable } from 'node:stream';
import {
  parseJsonBody,
  readMessageId,
  readToolCall,
  toolErrorResponse,
  type ToolCall,
} from '../core/mcp/mcp-message.js';
import { ServerBridge } from '../core/stdio/server-bridge.js';
import type { Run } from '../library/run.js';
import { ToolFailure } from '../library/tool-failure.js';
import { FailedReply } from './failed-reply.js';
import { mcpPayload } from './payloads.js';

export interface StdioOptions {
  run: Run;
  command: string;
  args: string[];
  agentInput: Readable;
  agentOutput: Writable;
  log?: (message: string) => void;
}

export async function runStdio(options: StdioOptions): Promise<number> {
  const { run, agentInput, agentOutput } = options;
  const log = options.log ?? (() => undefined);

  const server = spawn(options.command, options.args, {
    stdio: ['pipe', 'pipe', 'inherit'],
  });
  const exited = new Promise<number>((resolve) => {
    server.on('error', (error) => {
      log(`Could not start "${options.command}": ${error.message}`);
      resolve(1);
    });
    server.on('exit', (code) => resolve(code ?? 1));
  });

  const writeToAgent = (line: string) => agentOutput.write(`${line}\n`);
  const bridge = new ServerBridge((line) => server.stdin.write(`${line}\n`));

  createInterface({ input: server.stdout }).on('line', (line) => {
    if (!bridge.receive(line)) {
      writeToAgent(line);
    }
  });

  const inFlight = new Set<Promise<void>>();
  const agentLines = createInterface({ input: agentInput });
  agentLines.on('line', (line) => {
    const handled = handleAgentLine(line).then(
      (reply) => {
        if (reply !== null) {
          writeToAgent(reply);
        }
      },
      (error: unknown) => {
        log(error instanceof Error ? error.message : String(error));
        const id = readMessageId(line);
        if (id !== null) {
          writeToAgent(
            JSON.stringify({
              jsonrpc: '2.0',
              id,
              error: {
                code: -32603,
                message: 'agentQuake could not reach the MCP server',
              },
            }),
          );
        }
      },
    );
    inFlight.add(handled);
    void handled.finally(() => inFlight.delete(handled));
  });
  agentLines.on('close', () => {
    void Promise.allSettled(Array.from(inFlight)).then(() =>
      server.stdin.end(),
    );
  });

  async function handleAgentLine(line: string): Promise<string | null> {
    const call = readToolCall(parseJsonBody(Buffer.from(line)));
    if (!call) {
      return bridge.send(line);
    }
    return callTool(call, line);
  }

  async function callTool(
    call: ToolCall,
    line: string,
  ): Promise<string | null> {
    const send = run.tool(
      call.name,
      async (_arguments: Record<string, unknown>) => {
        const reply = await bridge.send(line);
        if (reply !== null && isFailedReply(reply)) {
          throw new FailedReply(reply, 'The MCP server reported an error');
        }
        return reply;
      },
      { payload: mcpPayload },
    );
    try {
      return await send(call.arguments);
    } catch (error) {
      if (error instanceof FailedReply) {
        return error.reply as string;
      }
      if (error instanceof ToolFailure) {
        log(`fault on ${call.name}: HTTP ${error.status}`);
        return JSON.stringify(
          toolErrorResponse(call, error.status, error.body),
        );
      }
      throw error;
    }
  }

  return exited;
}

function isFailedReply(line: string): boolean {
  const message = parseJsonBody(Buffer.from(line)) as {
    error?: unknown;
    result?: { isError?: unknown };
  } | null;
  return Boolean(message?.error) || message?.result?.isError === true;
}
