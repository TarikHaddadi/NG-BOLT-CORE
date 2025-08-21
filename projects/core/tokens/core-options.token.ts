import { InjectionToken } from '@angular/core';

import { CoreOptions } from '@cadai/pxs-ng-core/interfaces';

export const CORE_OPTIONS = new InjectionToken<Required<CoreOptions>>('CORE_OPTIONS');
