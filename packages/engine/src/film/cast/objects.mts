import { objects1 } from './objects-1.mjs';
import { objects2 } from './objects-2.mjs';
import { objects3 } from './objects-3.mjs';
import { objects4 } from './objects-4.mjs';
import { objects5 } from './objects-5.mjs';
import { objects6 } from './objects-6.mjs';
import { objects7 } from './objects-7.mjs';
import { objects8 } from './objects-8.mjs';
import type { ObjectDefinition } from './contracts.mjs';
import { required } from './common.mjs';
export const OBJECTS = {
  ...objects1,
  ...objects2,
  ...objects3,
  ...objects4,
  ...objects5,
  ...objects6,
  ...objects7,
  ...objects8,
};
export function objectDefinition(name: string): ObjectDefinition {
  return required(
    Object.entries(OBJECTS).find(([key]) => key === name)?.[1],
    'drawing ' + name,
  );
}
