import { CommonModule } from '@angular/common';
import { Component, computed, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { Router, RouterModule } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';

import { KeycloakService } from '@cadai/pxs-ng-core/services';

@Component({
  selector: 'app-forbidden',
  standalone: true,
  imports: [CommonModule, RouterModule, MatButtonModule, MatIconModule, TranslateModule],
  styleUrls: ['./forbidden.component.scss'],
  templateUrl: './forbidden.component.html',
})
export class ForbiddenComponent {
  private readonly router = inject(Router);
  private readonly kc = inject(KeycloakService);

  isAuth = computed(() => this.kc.isAuthenticated);

  goHome() {
    // adjust if your host uses a different landing route
    void this.router.navigateByUrl('/dashboard').catch(() => this.router.navigateByUrl('/'));
  }

  goBack() {
    if (window.history.length > 1) window.history.back();
    else this.goHome();
  }

  login() {
    void this.kc.login();
  }
}
