export function check(ok: unknown, m: string): asserts ok {
  if (!ok) throw Error(`valuation scene: ${m}`);
}
