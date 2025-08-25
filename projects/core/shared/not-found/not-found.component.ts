import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { Router, RouterModule } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';

@Component({
  selector: 'app-not-found',
  standalone: true,
  imports: [CommonModule, RouterModule, MatButtonModule, MatIconModule, TranslateModule],
  styleUrls: ['./not-found.component.scss'],
  templateUrl: './not-found.component.html',
})
export class NotFoundComponent {
  private readonly router = inject(Router);
  currentUrl = this.router.url;

  goHome() {
    void this.router.navigateByUrl('/dashboard').catch(() => this.router.navigateByUrl('/'));
  }

  goBack() {
    if (window.history.length > 1) window.history.back();
    else this.goHome();
  }
}
