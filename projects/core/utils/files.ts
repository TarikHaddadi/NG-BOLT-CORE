export function isFiles(arr: unknown[]): arr is File[] {
  return arr.every((x) => x instanceof File);
}
export function isStrings(arr: unknown[]): arr is string[] {
  return arr.every((x) => typeof x === 'string');
}
