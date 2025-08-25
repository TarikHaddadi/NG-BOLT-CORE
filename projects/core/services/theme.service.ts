import { OverlayContainer } from '@angular/cdk/overlay';
import { isPlatformBrowser } from '@angular/common';
import { inject, Injectable, PLATFORM_ID, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private _isDark = signal<boolean>(false);
  public isDark = this._isDark.asReadonly();

  private overlay = inject(OverlayContainer);
  private platformId = inject(PLATFORM_ID);

  constructor() {
    const isBrowser = isPlatformBrowser(this.platformId);
    const storedTheme = isBrowser ? localStorage.getItem('theme') : null;
    const isDark = storedTheme === 'dark';
    this._isDark.set(isDark);
    this.setTheme(isDark);
  }

  toggleTheme(): void {
    const newDark = !this._isDark();
    this._isDark.set(newDark);
    this.setTheme(newDark);
    try {
      localStorage.setItem('theme', newDark ? 'dark' : 'light');
    } catch {}
  }

  private setTheme(isDark: boolean): void {
    // Swap CSS file (if present)
    if (typeof document !== 'undefined') {
      const themeLink = document.getElementById('theme-style') as HTMLLinkElement | null;
      if (themeLink) {
        themeLink.href = isDark ? 'assets/theme/dark.css' : 'assets/theme/light.css';
      }

      // Tag <html> for global scoping
      const html = document.documentElement.classList;
      html.remove('dark', 'light');
      html.add(isDark ? 'dark' : 'light');
    }

    // Mirror classes to the CDK overlay container
    this.updateOverlayClasses(isDark);
  }

  /** Add a stable hook + current theme to the overlay container. */
  private updateOverlayClasses(isDark: boolean): void {
    const cls = this.overlay.getContainerElement().classList;
    cls.add('app-overlay'); // your custom hook class
    cls.remove('dark', 'light'); // keep only the current one
    cls.add(isDark ? 'dark' : 'light');
  }
}
