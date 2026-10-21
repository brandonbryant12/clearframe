export function check(ok: unknown, message: string): asserts ok {
  if (!ok) throw new Error(`stat: ${message}`);
}
