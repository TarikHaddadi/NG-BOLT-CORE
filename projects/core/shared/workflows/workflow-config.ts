import { FactoryProvider } from '@angular/core';
import {
  DfArrowhead,
  DfConnectionType,
  DfOptions,
  provideNgDrawFlowConfigs,
} from '@ng-draw-flow/core';

export const DRAW_FLOW_PROVIDER: FactoryProvider = provideNgDrawFlowConfigs({
  connection: {
    type: DfConnectionType.SmoothStep,
    arrowhead: { type: DfArrowhead.Arrow },
    curvature: 0.25,
  },
  nodes: {},
} as Partial<DfOptions>);
