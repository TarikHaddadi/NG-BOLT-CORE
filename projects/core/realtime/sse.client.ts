import { RealtimeClient, RealtimeEventMap } from '@cadai/pxs-ng-core/interfaces';

type DecoderMap<M extends RealtimeEventMap> = Partial<{
  [K in keyof M & string]: (raw: unknown) => M[K];
}>;

/**
 * SSE client with optional per-channel decoders.
 * If you don't pass decoders, it will JSON-parse strings and then cast.
 */
export class SseClient<M extends RealtimeEventMap = RealtimeEventMap> implements RealtimeClient<M> {
  private es?: EventSource;
  private handlers = new Map<string, Set<(d: unknown) => void>>();

  /**
   * @param endpoint     SSE endpoint (same-origin recommended), e.g. '/rt/events'
   * @param decoders     Optional per-channel decoders: raw -> typed payload
   * @param namedEvents  Optional list of named SSE events to listen to
   * @param commandUrl   HTTP endpoint used by publish() to send commands (default '/sse/publish')
   */
  constructor(
    private endpoint: string,
    private decoders?: DecoderMap<M>,
    private namedEvents?: Array<keyof M & string>,
    private commandUrl: string = '/sst/publish',
  ) {}

  async connect(): Promise<void> {
    if (this.es) return;
    // withCredentials=true to carry cookies to your BFF (session-based auth)
    this.es = new EventSource(this.endpoint, { withCredentials: true });

    // Default (no event name) messages
    this.es.onmessage = (e) => {
      const ch = '__default__' as keyof M & string;
      this.dispatch(ch, this.decode(ch, e.data));
    };

    // Optional named events: server emits "event: <name>"
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
    set.add(cb as (d: unknown) => void); // stored as unknown internally
    this.handlers.set(channel, set);
    return () => set.delete(cb as (d: unknown) => void);
  }

  /**
   * Outbound command to your BFF.
   * Sends JSON: { channel, payload } to `commandUrl` with cookies included.
   * Add CSRF header here if your BFF requires it.
   */
  async publish<K extends keyof M & string>(channel: K, payload: M[K]): Promise<void> {
    const res = await fetch(this.commandUrl, {
      method: 'POST',
      credentials: 'include', // send session cookie
      headers: {
        'Content-Type': 'application/json',
        // 'X-CSRF-Token': '<token>'           // <-- add if needed
      },
      body: JSON.stringify({ channel, payload }),
    });

    if (!res.ok) {
      const text = await safeText(res);
      throw new Error(`SSE publish failed (${res.status}): ${text || res.statusText}`);
    }
  }

  // ---- internals

  /** Decode raw event data into the typed payload for the channel. */
  private decode<K extends keyof M & string>(channel: K, raw: unknown): M[K] {
    const base = typeof raw === 'string' ? tryJsonParse(raw) : raw;
    const dec = this.decoders?.[channel];
    // If a decoder exists, use it; otherwise cast after JSON parse.
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
