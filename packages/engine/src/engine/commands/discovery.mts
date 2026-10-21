import { sketches, sketch, sketchByName } from '../../film/sketches.mjs';

import type { CommandContext } from './options.mjs';

export async function findCommand({ positionals, o }: CommandContext) {
  // One search over the whole library: blocks, sketches, playbooks, looks, cast shapes and moves,
  // stage mechanisms, examples. A short mixed shortlist, then the exact authoring for one entry.
  const { find, line, detail, markdown } =
    await import('../../film/discover.mjs');
  if (o.index) return console.log(markdown());
  if (o.id) return console.log(JSON.stringify(await detail(o.id), null, 1));
  if (!positionals[0])
    return console.log(
      'clearframe find "what you want to show" [--kind block,sketch,...] [--json] | find --id kind:name | find --index',
    );
  const hits = find(positionals.join(' '), {
    kinds: o.kind?.split(','),
    limit: 10,
  });
  if (o.json) return console.log(JSON.stringify(hits, null, 1));
  return console.log(
    hits.map(line).join('\n') +
      "\n\nfind --id KIND:NAME for the exact authoring of one; sketch NAME [--vertical] prints a sketch's drawing to copy and adapt.",
  );
}

export async function sketchCommand({ positionals, o }: CommandContext) {
  if (!positionals[0])
    return console.log(
      sketches()
        .map(
          (s) =>
            `${s.name.padEnd(10)} ${s.summary}\n           Use for: ${s.use}`,
        )
        .join('\n') +
        '\n\nclearframe sketch NAME [--vertical] prints canvas props to adapt; ambient prints an art.under layer.',
    );
  // A system diagram prints its editable source, not hundreds of compiled shapes.
  const source = sketchByName(positionals[0]);
  if (source?.diagram)
    return console.log(
      JSON.stringify(
        { title: 'Your headline', diagram: source.diagram },
        null,
        1,
      ),
    );
  // A sketch with words to replace, moments to cue or numbers to set is used as it is: say how
  // (on stderr, so stdout stays the drawing to adapt).
  const { sketchExample } = await import('../../film/discover.mjs');
  const use = sketchExample(positionals[0]);
  if (use.props.sketchText || use.props.sketchSay || use.props.sketchParams) {
    const params = Object.entries(source?.params ?? {}).map(
      ([k, d]) =>
        `  ${k}: ${d.about ?? ''} (default ${JSON.stringify(d.default)}${d.min != null || d.max != null ? `, ${d.min ?? ''}–${d.max ?? ''}` : ''})`,
    );
    const free = (source?.freeMoments ?? []).filter(
        (m) => m in (use.props.sketchSay ?? {}),
      ),
      moments = Object.keys(use.props.sketchSay ?? {}).filter(
        (m) => !free.includes(m),
      );
    // Options that add moments (report, choices, expires, send): the order with all of them on.
    const { sketchMoments } = await import('../../film/sketches.mjs');
    const flags = Object.entries(source?.params ?? {})
      .filter(([, d]) => d.default === false)
      .map(([k]) => k);
    const full = flags.length
      ? sketchMoments(
          positionals[0],
          Object.fromEntries(flags.map((k) => [k, true])),
        )
      : [];
    const more =
      full.length > moments.length + free.length
        ? `\nWith ${flags.join(', ')} on: ${full.filter((m) => !free.includes(m)).join(' → ')}.`
        : '';
    const freeHint = free.length
      ? ` ${free.join(', ')} may land on any word.`
      : '';
    console.error(
      `Use it as a beat (fill the words, cue the moments on narration words, set the numbers):\n${JSON.stringify(use, null, 1)}${params.length ? `\nNumbers:\n${params.join('\n')}` : ''}${moments.length > 1 ? `\nMoments happen in this order: ${moments.join(' → ')}. Give them words the narration says in the same order.${freeHint}${more}` : ''}\nThe drawing below is for adapting by hand.\n`,
    );
  }
  return console.log(
    JSON.stringify(
      sketch(positionals[0], o.vertical ? 'vertical' : 'landscape'),
      null,
      1,
    ),
  );
}
