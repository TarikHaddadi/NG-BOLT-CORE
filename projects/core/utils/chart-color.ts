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

export const paletteFns = [
  COLOR.primary,
  COLOR.accent,
  COLOR.warn,
  COLOR.neutral,
  COLOR.success,
  COLOR.primaryVariant,
];

export const pick = (ctx: any) => paletteFns[ctx.dataIndex % paletteFns.length]();
export const fill30 = (ctx: any) => `color-mix(in srgb, ${pick(ctx)} 30%, transparent)`;

export const primary = () => COLOR.primary();
export const neutral = () => COLOR.neutral();
export const warn = () => COLOR.warn();
export const success = () => COLOR.success();
export const accent = () => COLOR.accent();

export const linearGradientSuccess = (ctx: any, isDark: boolean) =>
  linearGradient(
    ctx,
    cssVar('--mat-success', 'rgba(255,64,129,0.35)'),
    isDark ? 'rgba(0,0,0,0)' : 'rgba(255, 255, 255, 0)',
  );
export const linearGradientWarn = (ctx: any, isDark: boolean) =>
  linearGradient(
    ctx,
    cssVar('--mat-warn', 'rgba(255,64,129,0.35)'),
    isDark ? 'rgba(0,0,0,0)' : 'rgba(255, 255, 255, 0)',
  );
export const linearGradientAccent = (ctx: any, isDark: boolean) =>
  linearGradient(
    ctx,
    cssVar('--mat-accent', 'rgba(255,64,129,0.35)'),
    isDark ? 'rgba(0,0,0,0)' : 'rgba(255, 255, 255, 0)',
  );
export const linearGradientNeutral = (ctx: any, isDark: boolean) =>
  linearGradient(
    ctx,
    cssVar('--mat-neutral', 'rgba(255,64,129,0.35)'),
    isDark ? 'rgba(0,0,0,0)' : 'rgba(255, 255, 255, 0)',
  );
export const linearGradientPrimary = (ctx: any, isDark: boolean) =>
  linearGradient(
    ctx,
    cssVar('--mat-primary', 'rgba(255,64,129,0.35)'),
    isDark ? 'rgba(0,0,0,0)' : 'rgba(255, 255, 255, 0)',
  );

export const successFill = () => `color-mix(in srgb, ${success()} 30%, transparent)`;
export const accentFill = () => `color-mix(in srgb, ${accent()} 30%, transparent)`;
export const warnFill = () => `color-mix(in srgb, ${warn()} 30%, transparent)`;
export const neutralFill = () => `color-mix(in srgb, ${neutral()} 30%, transparent)`;
export const primaryFill = () => `color-mix(in srgb, ${primary()} 30%, transparent)`;
