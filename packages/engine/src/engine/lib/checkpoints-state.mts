import fs from 'node:fs';
import path from 'node:path';
import { loadStoryboard } from './project.mjs';
import { plan } from './generate.mjs';
import { computeTiming } from './timing.mjs';
import { mtime, anyAnswered, decisions } from './checkpoints-direction.mjs';
import { roughMilestone, finalMilestone } from './checkpoints-milestones.mjs';
export function checkpointState(root: string, mode: string) {
  const sb = loadStoryboard(root);
  const direction = fs.existsSync(path.join(root, 'DIRECTION.md'))
    ? fs.readFileSync(path.join(root, 'DIRECTION.md'), 'utf8')
    : '';
  const story = fs.readFileSync(path.join(root, 'storyboard.json'), 'utf8');
  const sample =
    /illustrative|sample data|fictional|replace before publishing/i;
  const samples =
    (sb.sources ?? []).filter((s) =>
      sample.test(`${s.title ?? ''} ${s.id ?? ''}`),
    ).length + (sample.test(story) ? 1 : 0);
  const narrated = sb.beats.filter((b) => b.vo).length;
  const costs = plan(root);
  const pending = costs.rows.filter((r) => r.status === 'todo' && r.cost > 0);
  const owed = pending.reduce((a, r) => a + r.cost, 0);
  const sheet =
    mtime(path.join(root, 'build', 'sheet.png')) ||
    mtime(path.join(root, 'sheet.png'));
  const edited = mtime(path.join(root, 'storyboard.json'));
  const timing = computeTiming(root);
  const decided = decisions(direction);
  const spine = anyAnswered(direction, [
    'The question the film answers:',
    'Question:',
    'Spine:',
  ]);
  const drafted = costs.rows
    .filter((r) => r.kind === 'voice')
    .every((r) => r.status !== 'todo');
  const rough = roughMilestone(root, { mode });
  const final = finalMilestone(root, { mode });
  return {
    sb,
    direction,
    samples,
    narrated,
    pending,
    owed,
    sheet,
    edited,
    timing,
    decided,
    spine,
    drafted,
    rough,
    final,
  };
}
export type CheckpointState = ReturnType<typeof checkpointState>;
