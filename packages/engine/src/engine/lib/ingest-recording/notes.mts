import fs from 'node:fs';
import path from 'node:path';
import { round } from '../util.mjs';

import type { Storyboard } from '../../domain.mjs';
import type { RecordingOptions } from './contracts.mjs';

export async function chosenDirection(
  o: RecordingOptions,
): Promise<{ treatment?: string; playbook?: string }> {
  const { directionOptions } = await import('../../../film/directions.mjs');
  const { treatmentById } = await import('../../../film/treatments.mjs');
  const { item } = await import('../../../film/library.mjs');
  const chosen: { treatment?: string; playbook?: string } = directionOptions({
    direction: o.direction,
    treatment: o.treatment,
    playbook: o.playbook,
  });
  const { treatment, playbook } = chosen;
  if (treatment && !treatmentById(treatment))
    throw new Error(`Unknown treatment ${treatment}`);
  if (playbook && !item('playbooks', playbook))
    throw new Error(`Unknown playbook ${playbook}`);
  return { treatment, playbook };
}

export async function applyRecordingTreatment(
  sb: Storyboard,
  treatment: string | undefined,
  theme: RecordingOptions['theme'],
): Promise<void> {
  if (!treatment) return;
  const { applyTreatment } = await import('../../../film/treatments.mjs');
  applyTreatment(sb, treatment, { recording: true });
  // A visual treatment cannot alter the recording's clock or introduce generated speech.
  delete sb.voice;
  sb.transition = 'cut';
  sb.pacing = { continuous: true };
  sb.music = false;
  if (theme) sb.theme = theme;
}

export interface RecordingNotes {
  audio: string;
  from: number;
  duration: number;
  beats: number;
  direction?: string;
  treatment?: string;
  playbook?: string;
}

export async function writeRecordingNotes(
  root: string,
  sb: Storyboard,
  n: RecordingNotes,
): Promise<void> {
  const { directionMarkdown, directionRefs } =
    await import('../../../film/directions.mjs');
  const { directionTemplate, treatmentById } =
    await import('../../../film/treatments.mjs');
  const { vendor } = await import('../../../film/library.mjs');
  vendor(root, [
    ...directionRefs(n.direction, [
      ['treatments', n.treatment],
      ['playbooks', n.playbook],
    ]),
    ['palettes', typeof sb.theme === 'string' ? sb.theme : sb.theme?.base],
    ['types', sb.type],
  ]);
  fs.writeFileSync(
    path.join(root, 'DIRECTION.md'),
    directionTemplate(sb, n.treatment ? treatmentById(n.treatment) : null) +
      directionMarkdown(n.direction, {
        recording: true,
        playbook: n.playbook,
      }) +
      (!n.direction && n.playbook
        ? `\nVisual reference playbook: ${n.playbook}. Keep the imported recording and timing when adapting its pictures.\n`
        : ''),
  );
  fs.writeFileSync(
    path.join(root, 'BRIEF.md'),
    `# ${sb.title}\n\nImported ${n.beats} beats (${round(n.duration, 1)} s) from \`${path.basename(n.audio)}\`${n.from ? ` starting at ${n.from}s` : ''}. Every beat plays its slice of the recording; cuts sit in pauses, so the beats replay it without gaps. Word timings are measured from the supplied transcript.\n\nEvery beat starts as kinetic captions. Keep that where the words are the picture; elsewhere, change the block (keep \`vo\`, \`speaker\` and \`note\`): pull quotes (\`kinetic\` stack, \`quote\`), the numbers they mention (with sources), drawn explanations (\`canvas\`), speaker plates. Captions (\`${sb.captions === 'pop' ? 'pop' : 'true'}\`) keep the words on screen under any picture. When a stretch explains one process or place, draw it as a canvas \`world\` and let the camera follow the conversation through it (\`clearframe world DIR\` shows the plan). Do not edit \`vo\`: it must match the recording.\n`,
  );
}
