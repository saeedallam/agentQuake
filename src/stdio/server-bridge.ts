import { readMessageId } from '../mcp/mcp-message.js';

export class ServerBridge {
  constructor(private readonly write: (line: string) => void) {}

  private readonly pending = new Map<
    string | number,
    (reply: string) => void
  >();

  async send(line: string): Promise<string | null> {
    const id = readMessageId(line);
    if (id === null) {
      this.write(line);
      return null;
    }

    const reply = new Promise<string>((resolve) => {
      this.pending.set(id, resolve);
    });

    this.write(line);
    return reply;
  }

  receive(line: string): boolean {
    const id = readMessageId(line);
    if (id === null) {
      return false;
    }

    const resolve = this.pending.get(id);
    if (!resolve) {
      return false;
    }

    this.pending.delete(id);
    resolve(line);
    return true;
  }
}
