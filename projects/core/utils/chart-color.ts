export function cssVar(name: string, fallback?: string) {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name)?.trim();
  return v || fallback || '#888';
}

export function linearGradient(ctx: CanvasRenderingContext2D, from: string, to: string) {
  const g = ctx.createLinearGradient(0, 0, 0, ctx.canvas.height);
  g.addColorStop(0, from);
  g.addColorStop(1, to);
  return g;
}

export const COLOR = {
  primary: () => cssVar('--mat-primary', '#42a5f5'),
  primaryVariant: () => cssVar('--mat-primary-variant', '#1e88e5'),
  accent: () => cssVar('--mat-accent', '#ff4081'),
  warn: () => cssVar('--mat-warn', '#ec9a00ff'),
  neutral: () => cssVar('--mat-neutral', '#9e9e9e'),
  success: () => cssVar('--mat-success', '#4caf50'),
};
