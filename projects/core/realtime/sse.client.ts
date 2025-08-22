import { RealtimeClient, RealtimeEventMap } from '@cadai/pxs-ng-core/interfaces';

type DecoderMap<M extends RealtimeEventMap> = Partial<{
  [K in keyof M & string]: (raw: unknown) => M[K];
}>;

/**
 * SSE client with optional per-channel decoders.
 * If you don't pass decoders, it will JSON-parse strings and then cast.
 * Also supports outbound publish() via HTTP POST to a BFF command endpoint.
 */
export class SseClient<M extends RealtimeEventMap = RealtimeEventMap> implements RealtimeClient<M> {
  private es?: EventSource;
  private handlers = new Map<string, Set<(d: unknown) => void>>();

  /**
   * @param endpoint     SSE endpoint (same-origin), e.g. '/rt/events'
   * @param decoders     Optional per-channel decoders: raw -> typed payload
   * @param namedEvents  Optional named SSE events to listen to
   * @param commandUrl   Endpoint used by publish(); defaults to '/rt/command'
   */
  constructor(
    private endpoint: string,
    private decoders?: DecoderMap<M>,
    private namedEvents?: Array<keyof M & string>,
    private commandUrl: string = '/app/publish',
  ) {}

  async connect(): Promise<void> {
    if (this.es) return;
    this.es = new EventSource(this.endpoint, { withCredentials: true });

    // Default (unnamed) messages
    this.es.onmessage = (e) => {
      const ch = '__default__' as keyof M & string;
      this.dispatch(ch, this.decode(ch, e.data));
    };

    // Optional named events
    if (this.namedEvents?.length) {
      for (const ev of this.namedEvents) {
        this.es.addEventListener(ev, (e) => {
          const data = (e as MessageEvent).data;
          this.dispatch(ev, this.decode(ev, data));
        });
      }
    }
  }

  disconnect(): void {
    this.es?.close();
    this.es = undefined;
    this.handlers.clear();
  }

  subscribe<K extends keyof M & string>(channel: K, cb: (data: M[K]) => void): () => void {
    const set = this.handlers.get(channel) ?? new Set();
    set.add(cb as (d: unknown) => void);
    this.handlers.set(channel, set);
    return () => set.delete(cb as (d: unknown) => void);
  }

  /** POST { channel, payload } to the BFF (cookie-auth). */
  async publish<K extends keyof M & string>(channel: K, payload: M[K]): Promise<void> {
    const res = await fetch(this.commandUrl, {
      method: 'POST',
      credentials: 'include', // send session cookie
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ channel, payload }),
    });
    if (!res.ok) {
      const text = await safeText(res);
      throw new Error(`SSE publish failed (${res.status}): ${text || res.statusText}`);
    }
  }

  // ---- internals

  private decode<K extends keyof M & string>(channel: K, raw: unknown): M[K] {
    const base = typeof raw === 'string' ? tryJsonParse(raw) : raw;
    const dec = this.decoders?.[channel];
    return (dec ? dec(base) : (base as unknown)) as M[K];
  }

  private dispatch<K extends keyof M & string>(channel: K, data: M[K]) {
    this.handlers.get(channel)?.forEach((h) => h(data));
  }
}

function tryJsonParse(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {
    return s;
  }
}
async function safeText(res: Response): Promise<string> {
  try {
    return await res.text();
  } catch {
    return '';
  }
}
