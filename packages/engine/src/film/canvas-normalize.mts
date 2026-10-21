import { canvasInput } from './canvas-input.mjs';
import { checkPointer } from './pointer.mjs';

import { isList } from './guards.mjs';
import type { CanvasElement, Fail, FrameSize } from './types.mjs';
import { expandMacro } from './canvas-macro.mjs';
import { MAX_ELEMENTS } from './canvas-catalog.mjs';

import { checkDocument } from './canvas-document.mjs';
import { checkFields } from './canvas-check-fields.mjs';
import { checkCoordinates } from './canvas-check-coordinates.mjs';
import { checkVisibility } from './canvas-check-visibility.mjs';
import { checkTransform } from './canvas-check-transform.mjs';
import { checkSurface } from './canvas-check-surface.mjs';
import { checkEntrance } from './canvas-check-entrance.mjs';
import { checkCues } from './canvas-check-cues.mjs';
import { checkPlayback } from './canvas-check-playback.mjs';
import { checkMorph } from './canvas-check-morph.mjs';
import { checkSpoken } from './canvas-check-spoken.mjs';
import { checkStroke } from './canvas-check-stroke.mjs';
import { checkKeys } from './canvas-check-keys.mjs';
import { checkLoop } from './canvas-check-loop.mjs';
import { checkAlong } from './canvas-check-along.mjs';
import { checkTextures } from './canvas-check-textures.mjs';
import { checkEcho } from './canvas-check-echo.mjs';
import { checkPath } from './canvas-kind-path.mjs';
import { checkPoly } from './canvas-kind-poly.mjs';
import { checkText } from './canvas-kind-text.mjs';
import { checkIcon } from './canvas-kind-icon.mjs';
import { checkMeter } from './canvas-kind-meter.mjs';
import { checkParticles } from './canvas-kind-particles.mjs';
import { checkSolid } from './canvas-kind-solid.mjs';
import { checkSpotlight } from './canvas-kind-spotlight.mjs';
import { checkImage } from './canvas-kind-image.mjs';
import { checkGroup } from './canvas-kind-group.mjs';

/** Elements counted so far across one canvas (and its groups), and the frame they are drawn in. */
export interface ElementCount {
  count: number;
  frame?: FrameSize;
}
export function normalizeElements(
  list: unknown,
  where: string,
  fail: Fail,
  state: ElementCount = { count: 0 },
  depth = 0,
): CanvasElement[] {
  if (!isList(list)) fail(`${where} must be an array of elements`);
  if (depth > 4) fail(`${where}: groups nest at most four levels`);
  return list.map((input, i) => {
    const at = `${where}[${i}]`;

    // Its type and fields are checked below, before anything reads them.

    const el = structuredClone(
      expandMacro(canvasInput(input, at, fail), at, fail, state.frame),
    );

    if (++state.count > MAX_ELEMENTS)
      fail(`a canvas holds at most ${MAX_ELEMENTS} elements`);
    checkFields(el, at, fail);
    checkCoordinates(el, at, fail);
    checkVisibility(el, at, fail);
    checkTransform(el, at, fail);
    checkSurface(el, at, fail);
    checkEntrance(el, at, fail);
    checkCues(el, at, fail);
    checkPlayback(el, at, fail);
    checkMorph(el, at, fail);
    checkSpoken(el, at, fail);
    checkStroke(el, at, fail);
    checkKeys(el, at, fail);
    checkLoop(el, at, fail);
    checkAlong(el, at, fail);
    checkTextures(el, at, fail);
    checkEcho(el, at, fail);
    switch (el.type) {
      case 'path':
        checkPath(el, at, fail);
        break;
      case 'poly':
        checkPoly(el, at, fail);
        break;
      case 'text':
        checkText(el, at, fail);
        break;
      case 'document':
        checkDocument(el, at, fail);
        break;
      case 'pointer':
        checkPointer(el, at, fail);
        break;
      case 'icon':
        checkIcon(el, at, fail);
        break;
      case 'meter':
        checkMeter(el, at, fail);
        break;
      case 'particles':
        checkParticles(el, at, fail);
        break;
      case 'solid':
        checkSolid(el, at, fail);
        break;
      case 'spotlight':
        checkSpotlight(el, at, fail);
        break;
      case 'image':
        checkImage(el, at, fail);
        break;
      case 'group':
        checkGroup(el, at, fail, state, depth);
        break;
    }
    return el;
  });
}
