import { createInterface } from 'node:readline';

const write = (message) => process.stdout.write(`${JSON.stringify(message)}\n`);

write({ jsonrpc: '2.0', method: 'notifications/hello' });

createInterface({ input: process.stdin }).on('line', (line) => {
  const message = JSON.parse(line);
  if (message.id === undefined) {
    return;
  }
  if (message.method === 'tools/list') {
    write({
      jsonrpc: '2.0',
      id: message.id,
      result: { tools: [{ name: 'get_forecast' }] },
    });
  } else if (message.params?.name === 'broken_tool') {
    write({
      jsonrpc: '2.0',
      id: message.id,
      result: { content: [], isError: true },
    });
  } else {
    write({
      jsonrpc: '2.0',
      id: message.id,
      result: {
        content: [
          { type: 'text', text: `Sunny in ${message.params.arguments.city}` },
        ],
      },
    });
  }
});
