import { Inject, Injectable } from '@angular/core';

import { chooseRealtimeClient } from '@cadai/pxs-ng-core/factories';
import type { AppEvents, CoreOptions, RealtimeClient } from '@cadai/pxs-ng-core/interfaces';
import { CORE_OPTIONS } from '@cadai/pxs-ng-core/tokens';

@Injectable({ providedIn: 'root' })
export class RealtimeService {
  constructor(@Inject(CORE_OPTIONS) private readonly coreOpts: Required<CoreOptions>) {}

  private client?: RealtimeClient<AppEvents>;

  get ready(): boolean {
    return !!this.client;
  }

  /** Lazily create the transport client from runtime config. */
  init(): void {
    if (this.client) return;
    // Pass service worker so Push transport can subscribe if selected
    this.client =
      chooseRealtimeClient<AppEvents>(this.coreOpts.environments, {
        sw: navigator.serviceWorker,
      }) ?? undefined;
  }

  /** Ensure client exists and connect it. */
  async connect(): Promise<void> {
    this.init();
    await this.client?.connect();
  }

  /** Disconnect the underlying client (SSE close / WS close). */
  disconnect(): void {
    this.client?.disconnect();
  }

  /** Subscribe to a channel; returns an unsubscribe function. */
  subscribe = <K extends keyof AppEvents & string>(
    ch: K,
    cb: (p: AppEvents[K]) => void,
  ): (() => void) => {
    this.init();
    return this.client?.subscribe(ch, cb) ?? (() => {});
  };

  /** Publish a message if the transport supports it (WS or SSE command endpoint). */
  publish = <K extends keyof AppEvents & string>(
    ch: K,
    p: AppEvents[K],
  ): Promise<void> | undefined => {
    this.init();
    return this.client?.publish?.(ch, p);
  };
}
