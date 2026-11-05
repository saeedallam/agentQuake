import { parseJsonBody } from '../mcp/mcp-message.js';

export async function forwardAgentMessage(
  line: string,
  proxyUrl: string,
): Promise<string | null> {
  try {
    const response = await fetch(proxyUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: line,
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const text = (await response.text()).trim();
    if (text) {
      return text;
    }

    return null;
  } catch (error) {
    const message = parseJsonBody(Buffer.from(line)) as {
      id?: unknown;
    } | null;
    const id = message?.id;
    if (typeof id !== 'string' && typeof id !== 'number') {
      return null;
    }

    const reason = error instanceof Error ? error.message : String(error);
    return JSON.stringify({
      jsonrpc: '2.0',
      id,
      error: {
        code: -32603,
        message: `AgentChaos could not deliver the message: ${reason}`,
      },
    });
  }
}
