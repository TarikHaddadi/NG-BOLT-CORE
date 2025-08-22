import { RealtimeClient, RealtimeEventMap } from '@cadai/pxs-ng-core/interfaces';

type Envelope<C extends string = string, P = unknown> = { channel: C; payload: P };

export class WebSocketClient<M extends RealtimeEventMap = RealtimeEventMap>
  implements RealtimeClient<M>
{
  private ws?: WebSocket;
  private handlers = new Map<string, Set<(d: unknown) => void>>();

  constructor(
    private url: string,
    private factory: (u: string) => WebSocket = (u) => new WebSocket(u),
  ) {}

  async connect(): Promise<void> {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) return;
    this.ws = this.factory(this.url);
    await new Promise<void>((res, rej) => {
      if (!this.ws) return rej(new Error('WS init failed'));
      this.ws.onopen = () => res();
      this.ws.onerror = () => rej(new Error('WS error'));
    });
    this.ws.onmessage = (e) => {
      const msg = safeParse(e.data) as Envelope<keyof M & string, M[keyof M & string]> | null;
      if (!msg?.channel) return;
      this.handlers.get(msg.channel)?.forEach((h) => h(msg.payload));
    };
  }

  disconnect(): void {
    this.ws?.close();
    this.ws = undefined;
    this.handlers.clear();
  }

  subscribe<K extends keyof M & string>(channel: K, cb: (data: M[K]) => void): () => void {
    const set = this.handlers.get(channel) ?? new Set();
    set.add(cb as (d: unknown) => void);
    this.handlers.set(channel, set);
    return () => set.delete(cb as (d: unknown) => void);
  }

  async publish<K extends keyof M & string>(channel: K, payload: M[K]): Promise<void> {
    const env: Envelope<K, M[K]> = { channel, payload };
    this.ws?.send(JSON.stringify(env));
  }
}

function safeParse(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {
    return s;
  }
}
