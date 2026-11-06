import { ServerBridge } from './server-bridge.js';

function request(id: string | number, method = 'tools/call') {
  return JSON.stringify({ jsonrpc: '2.0', id, method });
}

function reply(id: string | number, text: string) {
  return JSON.stringify({ jsonrpc: '2.0', id, result: { text } });
}

function makeBridge() {
  const written: string[] = [];
  const bridge = new ServerBridge((line) => written.push(line));
  return { bridge, written };
}

describe('ServerBridge', () => {
  it('writes a request to the server and resolves with its reply', async () => {
    const { bridge, written } = makeBridge();

    const pending = bridge.send(request(7));
    expect(written).toEqual([request(7)]);

    expect(bridge.receive(reply(7, 'sunny'))).toBe(true);
    await expect(pending).resolves.toBe(reply(7, 'sunny'));
  });

  it('matches replies to requests by id, in any order', async () => {
    const { bridge } = makeBridge();

    const weather = bridge.send(request(7));
    const news = bridge.send(request(8));
    bridge.receive(reply(8, 'news'));
    bridge.receive(reply(7, 'sunny'));

    await expect(weather).resolves.toBe(reply(7, 'sunny'));
    await expect(news).resolves.toBe(reply(8, 'news'));
  });

  it('keeps string and number ids apart', async () => {
    const { bridge } = makeBridge();

    const byNumber = bridge.send(request(7));
    const byString = bridge.send(request('7'));
    bridge.receive(reply('7', 'string'));
    bridge.receive(reply(7, 'number'));

    await expect(byNumber).resolves.toBe(reply(7, 'number'));
    await expect(byString).resolves.toBe(reply('7', 'string'));
  });

  it('writes a notification and returns null without waiting', async () => {
    const { bridge, written } = makeBridge();
    const notification = JSON.stringify({
      jsonrpc: '2.0',
      method: 'notifications/initialized',
    });

    await expect(bridge.send(notification)).resolves.toBeNull();
    expect(written).toEqual([notification]);
  });

  it('does not claim server messages that answer no pending request', () => {
    const { bridge } = makeBridge();
    const serverNotification = JSON.stringify({
      jsonrpc: '2.0',
      method: 'notifications/tools/list_changed',
    });

    expect(bridge.receive(serverNotification)).toBe(false);
    expect(bridge.receive(reply(99, 'unknown'))).toBe(false);
    expect(bridge.receive('not json')).toBe(false);
  });

  it('claims a reply only once', async () => {
    const { bridge } = makeBridge();

    const pending = bridge.send(request(7));
    expect(bridge.receive(reply(7, 'first'))).toBe(true);
    expect(bridge.receive(reply(7, 'again'))).toBe(false);

    await expect(pending).resolves.toBe(reply(7, 'first'));
  });
});
