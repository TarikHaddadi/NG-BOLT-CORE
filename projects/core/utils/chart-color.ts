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
