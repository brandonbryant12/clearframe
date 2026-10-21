import crypto from 'node:crypto';
export const sha = (s: string) =>
  crypto.createHash('sha256').update(s).digest('hex').slice(0, 16);

export const fail = (message: string, status = 400) =>
  Object.assign(new Error(message), { status });
export const clip = (value: unknown, n: number): string => {
  const s = String(value ?? '');
  return s.length > n ? `${s.slice(0, n - 1)}…` : s;
};
