export function check(ok: unknown, m: string): asserts ok {
  if (!ok) throw Error(`correlation scene: ${m}`);
}
