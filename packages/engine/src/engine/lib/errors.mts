/** Convert failures at I/O boundaries without assuming that thrown values are Errors. */
export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
export function errorCode(error: unknown): string | undefined {
  return error !== null &&
    typeof error === 'object' &&
    'code' in error &&
    typeof error.code === 'string'
    ? error.code
    : undefined;
}
export function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
export function record(
  value: unknown,
  label = 'value',
): Record<string, unknown> {
  if (!isRecord(value)) throw new TypeError(`${label} must be an object.`);
  return value;
}
