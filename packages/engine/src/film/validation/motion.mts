import type { BlockProps, PropHelpers } from '../types.mjs';

import type { BlockValidator } from './contracts.mjs';
import { nodes } from './helpers.mjs';

export const validateKinetic: BlockValidator = (
  p: BlockProps,
  h: PropHelpers,
) => {
  p.mode ??= 'highlight';
  p.align ??= p.mode === 'stack' ? 'center' : 'left';
  // Poster type (stack) pages on whole sentences and clauses; captions page every few words.
  p.maxWords ??= p.mode === 'stack' ? 14 : 6;
  p.maxGap ??= 0.6;
  p.maxDuration ??= p.mode === 'stack' ? 7 : 4;
  if (
    !['highlight', 'reveal', 'word', 'stack'].includes(p.mode) ||
    !['left', 'center'].includes(p.align) ||
    !Number.isInteger(p.maxWords) ||
    p.maxWords < 1 ||
    p.maxWords > 16
  )
    h.fail('invalid kinetic mode, align or maxWords');
  if (p.emphasis != null) {
    if (p.mode !== 'stack') h.fail('kinetic emphasis applies to stack mode');
    if (
      !Array.isArray(p.emphasis) ||
      p.emphasis.length < 1 ||
      p.emphasis.length > 8
    )
      h.fail('emphasis needs 1–8 words or phrases');
    p.emphasis.forEach((e) => h.text(e, 'emphasis', 60));
  }
  if (p.emphasisStyle != null && !['bold', 'serif'].includes(p.emphasisStyle))
    h.fail('kinetic emphasisStyle must be bold or serif');
  if (p.upper != null && typeof p.upper !== 'boolean')
    h.fail('upper must be true or false');
  if (
    !Number.isFinite(p.maxGap) ||
    p.maxGap < 0 ||
    p.maxGap > 5 ||
    !Number.isFinite(p.maxDuration) ||
    p.maxDuration < 0.5 ||
    p.maxDuration > 15
  )
    h.fail('kinetic maxGap must be 0–5 and maxDuration 0.5–15 seconds');
};

export const validateFlow: BlockValidator = (
  p: BlockProps,
  h: PropHelpers,
  { vertical },
) => {
  nodes('nodes', 2, 6, ['icon', 'label', 'detail', 'say'])(p, h);
  p.orientation ??= 'auto';
  if (!['auto', 'horizontal', 'vertical'].includes(p.orientation))
    h.fail('invalid orientation');
  if (vertical) p.orientation = 'vertical';
};

export const validateCycle: BlockValidator = (
  p: BlockProps,
  h: PropHelpers,
) => {
  nodes('nodes', 3, 6, ['icon', 'label'], { stagger: false })(p, h);
  p.period ??= 8;
  p.clockwise ??= true;
  if (!Number.isFinite(p.period) || p.period < 2 || p.period > 60)
    h.fail('period must be 2–60 seconds');
  if (typeof p.clockwise !== 'boolean') h.fail('clockwise must be boolean');
};

export const validateBreathing: BlockValidator = (
  p: BlockProps,
  h: PropHelpers,
) => {
  h.list(p.phases, 'phases', 2, 6);
  const phaseCount = p.phases.length;
  p.phases.forEach((phase, i) => {
    h.keys(phase, ['label', 'seconds', 'scale'], `phases[${i}]`);
    h.text(phase.label, 'phase label', 40);
    if (!phase.label?.trim()) h.fail('every phase needs a label');
    if (
      typeof phase.seconds !== 'number' ||
      !Number.isFinite(phase.seconds) ||
      phase.seconds < 0.25 ||
      phase.seconds > 30
    )
      h.fail('phase seconds must be 0.25–30');
    if (phase.scale == null && phaseCount === 2)
      phase.scale = i ? 'contract' : 'expand';
    if (
      typeof phase.scale !== 'string' ||
      !['expand', 'hold', 'contract'].includes(phase.scale)
    )
      h.fail('each phase needs scale expand, hold or contract');
  });
  p.minScale ??= 0.55;
  p.maxScale ??= 1;
  p.ring ??= true;
  if (
    !Number.isFinite(p.minScale) ||
    !Number.isFinite(p.maxScale) ||
    p.minScale < 0.2 ||
    p.maxScale > 1 ||
    p.minScale >= p.maxScale
  )
    h.fail('scales require 0.2 ≤ minScale < maxScale ≤ 1');
  if (typeof p.ring !== 'boolean') h.fail('ring must be boolean');
};
