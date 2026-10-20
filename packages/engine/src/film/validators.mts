export { helpers } from './validation/helpers.mjs';
import type { BlockValidator } from './validation/contracts.mjs';
import {
  validateStat,
  validateKpis,
  validateDelta,
  validateMagnitude,
} from './validation/numbers.mjs';
import {
  validateBars,
  validateLine,
  validateWaffle,
  validateRing,
  validateDonut,
} from './validation/charts.mjs';
import {
  validateKinetic,
  validateFlow,
  validateCycle,
  validateBreathing,
} from './validation/motion.mjs';
import {
  validateSteps,
  validateTimeline,
  validateFunnel,
  validateMatrix,
  validateChecklist,
} from './validation/sequence.mjs';
import {
  validateImage,
  validateVideo,
  validateAnnotate,
} from './validation/media.mjs';
import { validateCanvas } from './validation/canvas.mjs';
import {
  validateTitle,
  validateStatement,
  validateEndcard,
  validateQuote,
  validateCallout,
  validateChapter,
  validateHighlight,
  validateCompare,
  validateEquation,
  validateStage,
} from './validation/text.mjs';

export const VALIDATORS = {
  stat: validateStat,
  kpis: validateKpis,
  delta: validateDelta,
  magnitude: validateMagnitude,
  bars: validateBars,
  line: validateLine,
  waffle: validateWaffle,
  ring: validateRing,
  donut: validateDonut,
  kinetic: validateKinetic,
  flow: validateFlow,
  cycle: validateCycle,
  breathing: validateBreathing,
  steps: validateSteps,
  timeline: validateTimeline,
  funnel: validateFunnel,
  matrix: validateMatrix,
  checklist: validateChecklist,
  image: validateImage,
  video: validateVideo,
  annotate: validateAnnotate,
  canvas: validateCanvas,
  title: validateTitle,
  statement: validateStatement,
  endcard: validateEndcard,
  quote: validateQuote,
  callout: validateCallout,
  chapter: validateChapter,
  highlight: validateHighlight,
  compare: validateCompare,
  equation: validateEquation,
  stage: validateStage,
} satisfies Record<string, BlockValidator>;
