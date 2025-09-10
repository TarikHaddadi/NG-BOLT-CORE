import { DestroyRef, Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

import { ToolbarAction } from '@cadai/pxs-ng-core/interfaces';

@Injectable({ providedIn: 'root' })
export class ToolbarActionsService {
  private readonly _actions = new BehaviorSubject<ToolbarAction[]>([]);
  readonly actions$ = this._actions.asObservable();

  set(actions: ToolbarAction[] = []) {
    this._actions.next(actions);
  }
  add(...actions: ToolbarAction[]) {
    this._actions.next([...this._actions.value, ...actions]);
  }
  remove(id: string) {
    this._actions.next(this._actions.value.filter((a) => a.id !== id));
  }
  clear() {
    this._actions.next([]);
  }

  /** Convenience: set actions and auto-clear when the caller is destroyed */
  scope(destroyRef: DestroyRef, actions: ToolbarAction[] = []) {
    this.set(actions);
    destroyRef.onDestroy(() => this.clear());
  }
}
