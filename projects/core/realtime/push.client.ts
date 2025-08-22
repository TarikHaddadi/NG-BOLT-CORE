import { RealtimeClient, RealtimeEventMap } from '@cadai/pxs-ng-core/interfaces';

export type PushClientOptions = {
  /** Path to your service worker file (default: '/sw.js') */
  swPath?: string;
  /** POST URL to register subscription (default: '/push/subscribe') */
  subscribeUrl?: string;
  /** POST URL to unregister subscription (default: '/push/unsubscribe') */
  unsubscribeUrl?: string;
  /** Topics you want to associate server-side */
  topics?: string[];
  /** If true, do not auto-prompt; throw 'UserOptInRequired' if not granted */
  requireUserOptIn?: boolean;
  /** Override fetch (tests) */
  fetchFn?: typeof fetch;
};

export class PushClient<M extends RealtimeEventMap = RealtimeEventMap>
  implements RealtimeClient<M>
{
  private registration?: ServiceWorkerRegistration;
  private subscription?: PushSubscription;

  constructor(
    private vapidPublicKey?: string,
    private sw?: ServiceWorkerContainer,
    private opts: PushClientOptions = {},
  ) {}

  async connect(): Promise<void> {
    if (!this.sw) throw new Error('ServiceWorker not available');
    if (!('PushManager' in window)) throw new Error('Push not supported by this browser');

    // 1) Ensure SW is registered & ready
    const swPath = this.opts.swPath ?? '/sw.js';
    await this.sw.register?.(swPath);
    this.registration = await this.sw.ready;

    // 2) Ensure notification permission
    if (Notification.permission !== 'granted') {
      if (this.opts.requireUserOptIn) {
        // Let the UI trigger Notification.requestPermission() explicitly
        throw new Error('UserOptInRequired');
      }
      const perm = await Notification.requestPermission();
      if (perm !== 'granted') throw new Error('Push permission not granted');
    }

    // 3) Reuse or create subscription
    const existing = await this.registration.pushManager.getSubscription();
    if (existing) {
      this.subscription = existing;
      await this.syncWithServer('subscribe'); // idempotent upsert
      return;
    }

    if (!this.vapidPublicKey) throw new Error('Missing VAPID public key');

    const applicationServerKey = urlBase64ToUint8Array(this.vapidPublicKey);
    this.subscription = await this.registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey,
    });

    // 4) Send to BFF
    await this.syncWithServer('subscribe');
  }

  // For Push, we usually keep the subscription; disconnect is a no-op.
  disconnect(): void {}

  // Push is not a live socket; return a no-op unsubscribe
  subscribe<K extends keyof M & string>(_c: K, _cb: (d: M[K]) => void): () => void {
    return () => {};
  }
  publish?<K extends keyof M & string>(_c: K, _p: M[K]): Promise<void> {
    throw new Error('Push publish not supported');
  }
  // --- helpers
  private async syncWithServer(kind: 'subscribe' | 'unsubscribe') {
    const sub = this.subscription;
    if (!sub) return;
    const fetchFn = this.opts.fetchFn ?? fetch.bind(window);
    const url =
      kind === 'subscribe'
        ? (this.opts.subscribeUrl ?? '/push/subscribe')
        : (this.opts.unsubscribeUrl ?? '/push/unsubscribe');

    try {
      const payload = await toServerPayload(sub, this.opts.topics);
      await fetchFn(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      });
    } catch {
      // Swallow to avoid breaking app boot; surface via logs if desired.
    }
  }
}

// --- util: convert base64url VAPID key to Uint8Array
function urlBase64ToUint8Array(base64Url: string): Uint8Array {
  const padding = '='.repeat((4 - (base64Url.length % 4)) % 4);
  const base64 = (base64Url + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

// --- util: normalize payload for your BFF
async function toServerPayload(sub: PushSubscription, topics?: string[]) {
  // Most browsers already return base64url strings via toJSON()
  const json = sub.toJSON();
  const endpoint = json.endpoint ?? sub.endpoint;

  // Fallback if keys are missing in toJSON()
  const p256dh = json.keys?.['p256dh'] ?? base64url(sub.getKey('p256dh'));
  const auth = json.keys?.['auth'] ?? base64url(sub.getKey('auth'));

  return {
    endpoint,
    keys: { p256dh, auth },
    topics: topics ?? [],
  };
}

function base64url(buf: ArrayBuffer | null): string | undefined {
  if (!buf) return undefined;
  const bytes = new Uint8Array(buf);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
