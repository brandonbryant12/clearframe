import * as Schema from 'effect/Schema';
import type { ViewValue } from '../contracts/canvas.mjs';
import { TargetInputSchema } from './target-input.mjs';

export const ViewValueSchema: Schema.Codec<ViewValue> = Schema.suspend(() =>
  Schema.Union([
    Schema.Literal('auto'),
    Schema.Array(Schema.Finite).pipe(Schema.mutable),
    TargetInputSchema,
  ]),
);
