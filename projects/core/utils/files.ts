export function isFiles(arr: unknown[]): arr is File[] {
  return arr.every((x) => x instanceof File);
}
export function isStrings(arr: unknown[]): arr is string[] {
  return arr.every((x) => typeof x === 'string');
}

export function isFile(val: unknown): val is File {
  return typeof File !== 'undefined' && val instanceof File;
}
export function isString(val: unknown): val is string {
  return typeof val === 'string';
}
