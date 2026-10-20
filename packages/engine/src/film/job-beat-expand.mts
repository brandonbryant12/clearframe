import type {
  TimedBeat as TimingBeat,
  BlockProps as AuthoredProps,
} from '../engine/domain.mjs';

import { type BeatContext } from './job-types.mjs';

import { expandTeachingProps } from './teaching.mjs';
import { expandPlotProps } from './plots.mjs';
import { expandBarsProps } from './bars.mjs';
import { expandBridgeProps } from './bridge.mjs';
import { expandBreakdownProps } from './breakdown.mjs';
import { expandProcessProps } from './process.mjs';
import { expandDecisionProps } from './decision.mjs';
import { expandTableProps } from './table.mjs';

import { expandCastProps } from './cast.mjs';

import { expandStatProps } from './stat.mjs';
import { expandHistogramProps } from './histogram.mjs';
import { expandMultiplesProps } from './multiples.mjs';

import { cueResolver } from './job-cues.mjs';

import type { BeatBasics } from './job-beat-contracts.mjs';

export function expandBeatProps(
  b: TimingBeat,
  ctx: BeatContext,
  basics: BeatBasics,
): AuthoredProps {
  const { sb, film, report, cast = {} } = ctx;
  const { helperFrame, frame } = basics;
  const castProps =
    b.block === 'canvas' && b.props?.cast != null
      ? expandCastProps(b.props, helperFrame, {
          state: cast.state,
          objects: cast.objects,
          threads: cast.threads,
          look: cast.look,
          camera: cast.camera,
          unit: cast.unit,
          heading: sb.beats[b.index]?.heading ?? sb.heading,
          cue: cueResolver(b, frame),
          carry: cast,
          notes: report.warnings,
          captions: Boolean(film.captions && b.vo),
        })
      : b.props;
  return b.block === 'canvas'
    ? expandTableProps(
        expandDecisionProps(
          expandProcessProps(
            expandBreakdownProps(
              expandMultiplesProps(
                expandHistogramProps(
                  expandStatProps(
                    expandBridgeProps(
                      expandBarsProps(
                        expandPlotProps(
                          expandTeachingProps(castProps ?? {}, helperFrame),
                          helperFrame,
                        ),
                        helperFrame,
                      ),
                      helperFrame,
                    ),
                    helperFrame,
                  ),
                  helperFrame,
                ),
                helperFrame,
              ),
              helperFrame,
            ),
            helperFrame,
          ),
          helperFrame,
        ),
        helperFrame,
      )
    : (b.props ?? {});
}
