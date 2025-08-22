import { RealtimeClient, RealtimeEventMap } from '@cadai/pxs-ng-core/interfaces';

export type PushClientOptions = {
  swPath?: string; // default '/sw.js'
  subscribeUrl?: string; // default '/push/subscribe'
  unsubscribeUrl?: string; // default '/push/unsubscribe'
  topics?: string[];
  requireUserOptIn?: boolean; // if true, do not auto-prompt
  fetchFn?: typeof fetch; // override for tests
};

/**
 * Push is not a live socket. We:
 *  - register SW
 *  - ensure permission
 *  - create/reuse subscription
 *  - POST it to the BFF
 */
export class PushClient<M extends RealtimeEventMap = RealtimeEventMap>
  implements RealtimeClient<M>
{
  private reg?: ServiceWorkerRegistration;
  private sub?: PushSubscription;

  constructor(
    private vapidPublicKey?: string,
    private sw?: ServiceWorkerContainer,
    private opts: PushClientOptions = {},
  ) {}

  async connect(): Promise<void> {
    if (!this.sw) throw new Error('ServiceWorker not available');
    if (!('PushManager' in window)) throw new Error('Push not supported');

    const swPath = this.opts.swPath ?? '/sw.js';
    await this.sw.register?.(swPath);
    this.reg = await this.sw.ready;

    // Permission
    if (Notification.permission !== 'granted') {
      if (this.opts.requireUserOptIn) throw new Error('UserOptInRequired');
      const perm = await Notification.requestPermission();
      if (perm !== 'granted') throw new Error('Push permission not granted');
    }

    // Reuse or create subscription
    this.sub = (await this.reg.pushManager.getSubscription()) ?? undefined;
    if (!this.sub) {
      if (!this.vapidPublicKey) throw new Error('Missing VAPID public key');
      const key = urlBase64ToUint8Array(this.vapidPublicKey);
      this.sub = await this.reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: key,
      });
    }

    // Upsert to BFF
    await this.sync('subscribe');
  }

  disconnect(): void {
    // Usually keep the SW + subscription; explicit unsubscribe is a UI action
  }

  subscribe<K extends keyof M & string>(_c: K, _cb: (d: M[K]) => void): () => void {
    // Not a live stream; no-op
    return () => {};
  }

  publish?<K extends keyof M & string>(_c: K, _p: M[K]): Promise<void> {
    // Not applicable for browser Push
    throw new Error('Push publish not supported');
  }

  // ---- internals

  private async sync(kind: 'subscribe' | 'unsubscribe') {
    if (!this.sub) return;
    const url =
      kind === 'subscribe'
        ? (this.opts.subscribeUrl ?? '/push/subscribe')
        : (this.opts.unsubscribeUrl ?? '/push/unsubscribe');

    const payload = await toServerPayload(this.sub, this.opts.topics);
    const fetchFn = this.opts.fetchFn ?? fetch.bind(window);

    try {
      await fetchFn(url, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    } catch {
      // Don't crash the app if network sync fails
    }
  }
}

function urlBase64ToUint8Array(b64: string): Uint8Array {
  const padding = '='.repeat((4 - (b64.length % 4)) % 4);
  const base64 = (b64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

async function toServerPayload(sub: PushSubscription, topics?: string[]) {
  const json = sub.toJSON();
  const endpoint = json.endpoint ?? sub.endpoint;
  const p256dh = json.keys?.['p256dh'] ?? base64url(sub.getKey('p256dh'));
  const auth = json.keys?.['auth'] ?? base64url(sub.getKey('auth'));
  return { endpoint, keys: { p256dh, auth }, topics: topics ?? [] };
}

function base64url(buf: ArrayBuffer | null): string | undefined {
  if (!buf) return undefined;
  const bytes = new Uint8Array(buf);
  let bin = '';
  for (let i = 0; i < bytes.byteLength; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
