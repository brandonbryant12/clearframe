import * as Schema from 'effect/Schema';
import { BlockPropsSchema, ArtSchema, ElementSchema } from '../schemas.mjs';
import type { CritiqueBeat } from './critique-contracts.mjs';
import type { CastCarry } from '../../film/cast.mjs';
import { onScreenWords } from './critique-words.mjs';

import { expandPlotProps } from '../../film/plots.mjs';
import { expandBarsProps } from '../../film/bars.mjs';
import { expandBridgeProps } from '../../film/bridge.mjs';
import { expandCastProps } from '../../film/cast.mjs';
import { expandStatProps } from '../../film/stat.mjs';
import { expandHistogramProps } from '../../film/histogram.mjs';
import { expandMultiplesProps } from '../../film/multiples.mjs';

import { sketch, expandArt, sketchPreset } from '../../film/sketches.mjs';
import { diagramElements } from '../../film/system-diagrams.mjs';

// A cast's objects declared in an earlier beat carry forward into the beats that follow.

/**
 * A beat as it will be drawn: a canvas built from a library sketch is judged on the sketch's
 * elements (its loops, keys and first-frame picture), not on the two-line reference to it.
 */
export function asDrawn(
  b: CritiqueBeat,
  { width = 1920, height = 1080 }: { width?: number; height?: number } = {},
  castCarry: CastCarry = {},
): CritiqueBeat {
  try {
    if (b.art?.sketch)
      b = {
        ...b,
        art: Schema.decodeUnknownSync(ArtSchema)(
          expandArt(b.art, { width, height }),
        ),
      };
    if (b.block !== 'canvas') return b;
    if (b.props?.plot)
      return {
        ...b,
        props: expandPlotProps(b.props, { width, height, beatId: b.id }),
      };
    if (b.props?.bars)
      return {
        ...b,
        props: expandBarsProps(b.props, { width, height, beatId: b.id }),
      };
    if (b.props?.cast)
      return {
        ...b,
        _cast: true,
        props: expandCastProps(
          b.props,
          { width, height, beatId: b.id },
          {
            state: castCarry.state,
            objects: castCarry.objects,
            threads: castCarry.threads,
            look: castCarry.look,
            camera: castCarry.camera,
            unit: castCarry.unit,
            carry: castCarry,
          },
        ),
      };
    if (b.props?.bridge)
      return {
        ...b,
        props: expandBridgeProps(b.props, { width, height, beatId: b.id }),
      };
    if (b.props?.multiples)
      return {
        ...b,
        props: expandMultiplesProps(b.props, { width, height, beatId: b.id }),
      };
    if (b.props?.distribution)
      return {
        ...b,
        props: expandHistogramProps(b.props, { width, height, beatId: b.id }),
      };
    if (b.props?.stat)
      return {
        ...b,
        props: expandStatProps(b.props, { width, height, beatId: b.id }),
      };
    // A system diagram is judged on the shapes it compiles to (spoken cues count from 0 here).
    if (b.props?.diagram) {
      const { diagram, ...rest } = b.props;
      return {
        ...b,
        props: {
          ...rest,
          elements: [
            ...diagramElements(diagram, { width, height }).map((el) =>
              Schema.decodeUnknownSync(ElementSchema)(el),
            ),
            ...(rest.elements ?? []),
          ],
        },
      };
    }
  } catch {
    // createJob below reports invalid references as author-facing errors.
  }
  if (b.block !== 'canvas' || !b.props?.sketch) return b;
  const preset = sketchPreset(width, height);
  try {
    const d = sketch(b.props.sketch, preset, {
      seed: b.props.seed,
      text: b.props.sketchText,
      say: b.props.sketchSay,
      params: b.props.sketchParams,
    });
    const {
      sketch: _s,
      sketchText: _t,
      sketchSay: _y,
      sketchParams: _p,
      ...rest
    } = b.props;
    // The words read are the ones written in (its sketchText and any elements added): a sketch's own
    // chrome ("New message", "Cancel", "Send") is recognised, not read, and must not trip the reading pace.
    const _words = onScreenWords({
      text: b.props.sketchText ?? {},
      elements: b.props.elements ?? [],
    });
    return {
      ...b,
      _words,
      props: Schema.decodeUnknownSync(BlockPropsSchema)({
        ...d,
        ...rest,
        elements: [...d.elements, ...(b.props.elements ?? [])],
      }),
    };
  } catch {
    return b;
  }
}
