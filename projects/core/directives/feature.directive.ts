import { Directive, Input, TemplateRef, ViewContainerRef } from '@angular/core';

import { UserCtx } from '@cadai/pxs-ng-core/interfaces';
import { FeatureService } from '@cadai/pxs-ng-core/services';

@Directive({ selector: '[appFeature]', standalone: true })
export class FeatureDirective {
  private key = '';
  private user?: UserCtx;
  private rendered = false;

  constructor(
    private tpl: TemplateRef<unknown>,
    private vcr: ViewContainerRef,
    private features: FeatureService,
  ) {}

  @Input('appFeature') set appFeatureKey(key: string) {
    this.key = key;
    this.update();
  }
  @Input('appFeatureUser') set appFeatureUser(user: UserCtx | undefined) {
    this.user = user;
    this.update();
  }

  private update() {
    if (!this.key) return;
    const ok = this.features.isEnabled(this.key, this.user);
    if (ok && !this.rendered) {
      this.vcr.clear();
      this.vcr.createEmbeddedView(this.tpl);
      this.rendered = true;
    } else if (!ok && this.rendered) {
      this.vcr.clear();
      this.rendered = false;
    }
  }
}
