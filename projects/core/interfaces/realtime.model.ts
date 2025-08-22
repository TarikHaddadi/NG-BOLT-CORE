export type RealtimeEventMap = Record<string, unknown>;

export interface RealtimeClient<M extends RealtimeEventMap = RealtimeEventMap> {
  connect(): Promise<void>;
  disconnect(): void;
  /** Subscribe to a typed channel; returns an unsubscribe fn. */
  subscribe<K extends keyof M & string>(channel: K, cb: (data: M[K]) => void): () => void;

  /** Optionally publish a typed payload to a channel. */
  publish?<K extends keyof M & string>(channel: K, payload: M[K]): Promise<void>;
}

export interface AppEvents {
  alerts: { id: string; level: 'info' | 'warn' | 'error'; text: string };
  'jobs:progress': { jobId: number; percent: number };
  'chat:message': { room: string; from: string; text: string; at: string };
}
