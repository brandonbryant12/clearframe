import type { CastLook } from './contracts.mjs';
import { required } from './common.mjs';
export const pixelCell = (s: number) => Math.max(6, Math.round(s * 0.07));
export const LOOK = {
  tiles: {
    about:
      'flat rounded tiles with a soft shadow: clean product and business explainers',
    tile: () => ({}),
    mark: (o) => (o.color === 'surface' ? 'ink' : 'bg'),
    font: 'strong',
    label: 'semibold',
    shadow: true,
  } satisfies CastLook,
  drawn: {
    about:
      'pen on paper: an ink outline drawn by hand, colour hatched in, type in a hand; warm, human, a story told on a notepad',
    tile: (s) => ({
      stroke: 'ink',
      width: Math.max(3, s * 0.028),
      rough: {
        amount: 1.4,
        passes: 2,
        fill: 'hachure',
        gap: Math.max(5, s * 0.055),
        angle: -38,
        hatchWidth: Math.max(3, s * 0.03),
      },
    }),
    mark: () => 'ink',
    font: 'hand',
    label: 'hand',
    shadow: false,
  } satisfies CastLook,
  print: {
    about:
      'a two-colour press: colour in a dot screen, slightly off register, worn ink; editorial, retro, poster',
    tile: (s) => ({
      print: {
        screen: 'dots',
        cell: Math.max(5, Math.round(s * 0.055)),
        angle: 45,
        register: [Math.round(s * 0.025), -Math.round(s * 0.015)],
        wear: 0.25,
      },
    }),
    mark: (o) => (o.color === 'surface' ? 'ink' : 'bg'),
    font: 'poster',
    label: 'semibold',
    shadow: false,
  } satisfies CastLook,
  pixel: {
    about:
      'pixel art: bodies and details laid in square screen cells with a one-cell outline, mono type; games, retro tech, playful systems',
    tile: (s) => ({
      stroke: 'ink',
      width: Math.max(3, s * 0.03),
      mosaic: { style: 'pixel', tile: pixelCell(s), outline: true },
    }),
    mark: () => 'ink',
    font: 'mono',
    label: 'mono',
    shadow: false,
  } satisfies CastLook,
};

export function castLook(name: string): CastLook {
  return required(
    Object.entries(LOOK).find(([id]) => id === name)?.[1],
    'look ' + name,
  );
}
