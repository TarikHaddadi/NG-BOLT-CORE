import { RealtimeClient, RealtimeEventMap, RuntimeConfig } from '@cadai/pxs-ng-core/interfaces';
import { PushClient, SseClient, WebSocketClient } from '@cadai/pxs-ng-core/realtime';

export function chooseRealtimeClient<M extends RealtimeEventMap = RealtimeEventMap>(
  cfg: RuntimeConfig,
  deps?: { wsFactory?: (u: string) => WebSocket; sw?: ServiceWorkerContainer },
): RealtimeClient<M> | null {
  if (!cfg.realtime?.enabled) return null;

  const order = cfg.realtime.order ?? [];
  for (const kind of order) {
    if (kind === 'sse') {
      const sse = cfg.realtime.transports?.sse;
      if (sse?.enabled && sse.endpoint) return new SseClient<M>(sse.endpoint);
    }
    if (kind === 'websocket') {
      const ws = cfg.realtime.transports?.websocket;
      if (ws?.enabled && ws.url) return new WebSocketClient<M>(ws.url, deps?.wsFactory);
    }
    if (kind === 'push') {
      const push = cfg.realtime.transports?.push;
      if (push?.enabled) return new PushClient<M>(push.vapidPublicKey, deps?.sw);
    }
  }
  return null;
}
