import { hasCount, hasDigits } from './canvas.mjs';

import type { BeatState } from './job-beat-contracts.mjs';

export function canvasSources(state: BeatState): void {
  const { b, sb, props, report } = state;
  if (
    (b.props?.plot != null ||
      b.props?.bars != null ||
      b.props?.bridge != null ||
      b.props?.breakdown != null ||
      b.props?.process != null ||
      b.props?.decision != null ||
      b.props?.table != null ||
      b.props?.stat != null ||
      b.props?.distribution != null ||
      b.props?.multiples != null) &&
    !sb.sources.length
  )
    throw new Error('Quantitative plots need a storyboard.sources entry.');
  if (props.sourceElement && !sb.sources.length)
    throw new Error('sourceElement requires storyboard.sources.');
  const visibleSource = props.source || props.sourceElement;
  if (hasCount(props.elements) && (!visibleSource || !sb.sources.length))
    throw new Error(
      'Counted numbers need visible props.source and a storyboard.sources entry.',
    );
  if (hasDigits(props.elements) && !visibleSource)
    report.warnings.push(
      `${b.id}: canvas text contains digits; if they are figures, add a visible source.`,
    );
}
