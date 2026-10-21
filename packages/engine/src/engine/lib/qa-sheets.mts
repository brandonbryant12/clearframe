import path from 'node:path';

import { ffmpeg } from './util.mjs';

/** Share the decode and one-second samples; keep each sheet's original tile geometry. */
export async function sheets(
  file: string,
  dir: string,
  { portrait, seconds }: { portrait: boolean; seconds: number },
): Promise<void> {
  const sizes = [
    {
      name: 'timeline',
      width: portrait ? 160 : 240,
      columns: portrait ? 10 : 8,
    },
    { name: 'phone', width: 360, columns: portrait ? 6 : 4 },
  ];
  const filters = sizes.map(({ name, width, columns }, i) => {
    const rows = Math.max(1, Math.ceil(Math.ceil(seconds) / columns));
    return `[sample${i}]scale=${width}:-2,tile=${columns}x${rows}:padding=4:margin=4:color=0x161b22[${name}]`;
  });
  await ffmpeg([
    '-y',
    '-i',
    file,
    '-filter_complex',
    ['[0:v:0]fps=1,split=2[sample0][sample1]', ...filters].join(';'),
    ...sizes.flatMap(({ name }) => [
      '-map',
      `[${name}]`,
      '-frames:v',
      '1',
      '-threads',
      '1',
      path.join(dir, `${name}.png`),
    ]),
  ]);
}
