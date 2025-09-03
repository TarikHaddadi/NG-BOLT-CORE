import { SerializedError } from '@cadai/pxs-ng-core/interfaces';

export function serializeError(e: any): SerializedError {
  // Angular HttpErrorResponse
  if (e && typeof e === 'object' && 'status' in e && 'message' in e) {
    return {
      message: String(e.message ?? 'Http error'),
      name: e.name,
      status: e.status as number,
      statusText: (e as any).statusText,
      url: (e as any).url,
      payload: safeJson((e as any).error),
      stack: (e as any).stack,
    };
  }
  // JS Error
  if (e instanceof Error) {
    return { message: e.message, name: e.name, stack: e.stack };
  }
  // String/unknown
  return { message: typeof e === 'string' ? e : JSON.stringify(safeJson(e)) };
}

function safeJson(v: any) {
  try {
    return JSON.parse(JSON.stringify(v));
  } catch {
    return String(v);
  }
}
