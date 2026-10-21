export function splitInputs(params: {
  parts?: number[];
  prefix?: string;
  suffix?: string;
  total?: boolean;
}) {
  const parts = params.parts ?? [22, 8, 10, 60];
  const prefix = params.prefix ?? '',
    suffix = params.suffix ?? '%';
  const showTotal = params.total ?? true;
  if (!Array.isArray(parts) || parts.length < 2 || parts.length > 5)
    throw new Error('sketchParams.parts for split takes 2–5 values');
  if (parts.some((v) => !Number.isFinite(v) || v < 0))
    throw new Error(
      'sketchParams.parts for split must be numbers of 0 or more',
    );
  if (typeof prefix !== 'string' || typeof suffix !== 'string')
    throw new Error('sketchParams.prefix and suffix for split must be text');
  if (typeof showTotal !== 'boolean')
    throw new Error('sketchParams.total for split must be true or false');
  const sum = parts.reduce((a, v) => a + v, 0);
  if (!(sum > 0))
    throw new Error('sketchParams.parts for split must add up to more than 0');
  return { parts, prefix, suffix, sum, showTotal };
}
