export const show = { at: 0, enter: 'none' };

export const textWidth = (value: unknown, size: number): number =>
  String(value).length * size * 0.56;
