import { OverlayContainer } from '@angular/cdk/overlay';
import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  constructor(private overlay: OverlayContainer) {}

  /** Called by NgRx effect whenever theme state changes */
  public apply(isDark: boolean): void {
    // update <html> and overlay
    if (typeof document !== 'undefined') {
      const themeLink = document.getElementById('theme-style') as HTMLLinkElement | null;
      if (themeLink) {
        themeLink.href = isDark ? 'assets/theme/dark.css' : 'assets/theme/light.css';
      }
      const html = document.documentElement.classList;
      html.remove('dark', 'light');
      html.add(isDark ? 'dark' : 'light');
    }
    this.updateOverlayClasses(isDark);
  }

  private updateOverlayClasses(isDark: boolean): void {
    const cls = this.overlay.getContainerElement().classList;
    cls.add('app-overlay');
    cls.remove('dark', 'light');
    cls.add(isDark ? 'dark' : 'light');
  }
}
