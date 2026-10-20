import type { BlockProps, PropHelpers, ValidationFrame } from '../types.mjs';
export type BlockValidator = (
  props: BlockProps,
  helpers: PropHelpers,
  frame: ValidationFrame,
) => void;
