import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';

export interface OpenMenuPayload {
  nodeId: string;
  clientX: number;
  clientY: number;
}

@Injectable()
export class WfCanvasBus {
  readonly openMenu$ = new Subject<OpenMenuPayload>();
}
