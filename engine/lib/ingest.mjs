// Turn source material into raw material for a film: a research report into an evidence
// brief, a long recording into narrated beats on its own measured clock.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { ffmpeg, hashOf, pcmToWav, readJSON, round, writeJSON, log } from './util.mjs';
import { audioHash, wordKey } from './word-timing.mjs';
import { paths } from './project.mjs';
import { readPCM } from './levels.mjs';
import { alignScript } from './word-align.mjs';

// ------------------------------------------------------------------ research markdown

const CONTRAST =
  /\b(however|but|although|though|despite|yet|whereas|instead|in contrast|contrary|surprising(?:ly)?|unexpected(?:ly)?|counter-?intuitive|paradox|nevertheless|even though)\b/i;
// A figure: optional currency, a number, an optional range or "of N", and an optional unit.
const NUM = String.raw`[$€£¥]?\s?[-−]?\d[\d,]*(?:\.\d+)?`;
const UNIT = String.raw`%|°\s?[CF]|°|percentage points?|percent|per cent|pp|×|x|times|fold|k|bn|million|billion|trillion|thousand|hundred|kg|tonnes?|km|mph|km\/h|[kMGT]Wh?|ppm|hours?|days?|weeks?|months?|years?|minutes?|seconds?|people|users|households`;
const FIGURE = new RegExp(
  String.raw`${NUM}(?:\s?[–-]\s?${NUM})?(?:\s(?:of|in|out of)\s(?:every\s)?\d[\d,]*)?(?:\s?(?:${UNIT})(?![a-z]))?`,
  'gi',
);

/** Plain text of a markdown fragment, with citations kept as [n] markers and links as text. */
function plain(s) {
  return s
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]+)\]\((https?:[^)\s]+)[^)]*\)/g, '$1')
    .replace(/\[\^([^\]]+)\]/g, '[$1]')
    .replace(/(\*\*|__|`)/g, '')
    .replace(/(^|\s)[*_]([^*_]+)[*_](?=\s|[.,;:!?]|$)/g, '$1$2')
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}
const sentencesOf = text =>
  text
    .split(/(?<=[.!?][)"”’\]]?)\s+(?=[A-Z0-9“"(\[])/)
    .map(s => s.trim())
    .filter(s => s.length > 1);
const linksOf = s => [...s.matchAll(/\[([^\]]+)\]\((https?:[^)\s]+)[^)]*\)/g)].map(m => ({ title: m[1], url: m[2] }));
const citesOf = s => [...s.matchAll(/\[\^?([\w.-]+(?:\s*,\s*[\w.-]+)*)\]/g)].flatMap(m => m[1].split(/\s*,\s*/));

/** Parse a research report into sections, figures, tensions, questions, quotes, tables and sources. */
export function parseResearch(markdown) {
  let text = markdown.replace(/\r\n?/g, '\n');
  let title = null;
  const front = text.match(/^---\n([\s\S]*?)\n---\n/);
  if (front) {
    title = front[1].match(/^title:\s*["']?(.+?)["']?\s*$/m)?.[1] ?? null;
    text = text.slice(front[0].length);
  }
  const lines = text.split('\n');
  const sections = [],
    tables = [],
    quotes = [],
    sources = new Map(),
    refDefs = new Map();
  let section = { heading: 'Introduction', level: 1, paragraphs: [], links: [] },
    inCode = false,
    table = null,
    para = [];
  const addSource = (id, value) => {
    const url = value.match(/https?:\/\/\S+/)?.[0]?.replace(/[)>.,]+$/, '');
    const t = plain(value.replace(/https?:\/\/\S+/, '')).replace(/^[-–—:.,;\s]+|[-–—:.,;\s]+$/g, '');
    if (!sources.has(id)) sources.set(id, { id, title: t || url || id, url: url ?? null });
  };
  const flush = () => {
    if (para.length) {
      section.paragraphs.push(para.join(' '));
      para = [];
    }
  };
  const endTable = () => {
    if (table) {
      if (table.rows.length) tables.push({ ...table, section: section.heading });
      table = null;
    }
  };
  const referencesHeading = h => /^(references|sources|citations|bibliography|works cited|notes|footnotes)\b/i.test(h);
  for (const raw of lines) {
    const line = raw.trimEnd();
    if (/^\s*```/.test(line)) {
      inCode = !inCode;
      flush();
      continue;
    }
    if (inCode) continue;
    const heading = line.match(/^(#{1,6})\s+(.*)$/);
    if (heading) {
      flush();
      endTable();
      const h = plain(heading[2]);
      if (!title && heading[1].length === 1) {
        title = h;
        continue;
      }
      if (section.paragraphs.length || section.heading !== 'Introduction') sections.push(section);
      section = { heading: h, level: heading[1].length, paragraphs: [], links: [], references: referencesHeading(h) };
      continue;
    }
    const foot = line.match(/^\[\^([^\]]+)\]:\s*(.+)$/);
    if (foot) {
      flush();
      addSource(foot[1], foot[2]);
      continue;
    }
    const def = line.match(/^\[([^\]]+)\]:\s*(https?:\S+)(.*)$/);
    if (def) {
      refDefs.set(def[1], def[2]);
      addSource(def[1], `${def[3] || def[1]} ${def[2]}`);
      continue;
    }
    if (/^\s*\|/.test(line)) {
      flush();
      const cells = line
        .replace(/^\s*\||\|\s*$/g, '')
        .split('|')
        .map(c => plain(c));
      if (cells.every(c => /^:?-{2,}:?$/.test(c.replace(/\s/g, '')))) continue;
      if (!table) table = { headers: cells, rows: [] };
      else table.rows.push(cells);
      continue;
    }
    endTable();
    if (!line.trim()) {
      flush();
      continue;
    }
    const quote = line.match(/^>\s?(.*)$/);
    if (quote) {
      flush();
      const q = plain(quote[1]).replace(/^["“]|["”](?=\s*(?:[—–-]|$))/g, '');
      if (q.length > 20) quotes.push({ text: q, section: section.heading });
      continue;
    }
    const item = line.match(/^\s*(?:[-*+]|(\d+)[.)])\s+(.*)$/);
    if (item) {
      flush();
      // Numbered entries under a references heading, or "[n] ... http" lines, are sources.
      const cited = item[2].match(/^\[(\d+)\]\s*(.*)$/);
      if (section.references || cited) {
        addSource(cited?.[1] ?? item[1] ?? String(sources.size + 1), cited?.[2] ?? item[2]);
        continue;
      }
      section.paragraphs.push(item[2]);
      continue;
    }
    const bracketRef = line.match(/^\s*\[(\d+)\]\s+(.*https?:\/\/.*)$/);
    if (bracketRef || section.references) {
      flush();
      addSource(bracketRef?.[1] ?? String(sources.size + 1), bracketRef?.[2] ?? line);
      continue;
    }
    para.push(line.trim());
  }
  flush();
  endTable();
  sections.push(section);
  const body = sections.filter(s => !s.references);
  // Inline links become sources too, so every figure can point somewhere.
  for (const s of body)
    for (const p of s.paragraphs)
      for (const l of linksOf(p))
        if (![...sources.values()].some(x => x.url === l.url)) {
          const id = `L${sources.size + 1}`;
          sources.set(id, { id, title: l.title, url: l.url });
        }
  const sourceFor = sentenceMd => {
    const found = [];
    for (const l of linksOf(sentenceMd)) {
      const s = [...sources.values()].find(x => x.url === l.url);
      if (s) found.push(s.id);
    }
    for (const c of citesOf(sentenceMd)) if (sources.has(c)) found.push(c);
    return [...new Set(found)];
  };
  const figures = [],
    contrasts = [],
    questions = [],
    outline = [];
  let words = 0;
  for (const s of body) {
    let first = null,
      count = 0;
    for (const p of s.paragraphs) {
      // Split the markdown paragraph and its plain form in step so citations stay attached.
      for (const md of sentencesOf(p)) {
        const sentence = plain(md)
          .replace(/\s*\[[\w.,\s-]+\]/g, '')
          .trim();
        if (!sentence) continue;
        words += sentence.split(/\s+/).length;
        first ??= sentence;
        const cites = sourceFor(md);
        for (const m of sentence.matchAll(FIGURE)) {
          const token = m[0].trim();
          const n = Number((token.match(/[-−]?\d[\d,]*(?:\.\d+)?/)?.[0] ?? '').replace(/,/g, '').replace('−', '-'));
          if (!Number.isFinite(n) || !/\d/.test(token)) continue;
          const unit = token.replace(
            /^[$€£¥]?\s?[-−]?[\d,.]+(?:\s?[–-]\s?[$€£¥]?[\d,.]+)?(?:\s(?:of|in|out of)\s(?:every\s)?[\d,]+)?\s?/,
            '',
          );
          const bare = !unit && !/[$€£¥]/.test(token) && !/\s(?:of|in|out of)\s/.test(token) && !/[–-]/.test(token);
          const year = bare && /^(1[89]|20|21)\d\d$/.test(token);
          // A lone small integer ("step 2", "3 reasons") is rarely a statistic worth showing.
          if (year || (bare && Math.abs(n) < 10 && /^\d$/.test(token))) continue;
          figures.push({
            figure: token,
            value: n,
            unit: unit || (token.match(/^[$€£¥]/)?.[0] ?? ''),
            sentence,
            section: s.heading,
            sources: cites,
          });
          count++;
        }
        if (CONTRAST.test(sentence) && sentence.length < 280)
          contrasts.push({ sentence, section: s.heading, sources: cites });
        if (/\?$/.test(sentence)) questions.push({ sentence, section: s.heading });
        for (const q of sentence.matchAll(/[“"]([^”"]{30,240})[”"]/g)) quotes.push({ text: q[1], section: s.heading });
      }
    }
    outline.push({ heading: s.heading, level: s.level, lead: first, figures: count });
  }
  for (const t of tables)
    t.numeric = t.headers.map(
      (_, i) => t.rows.length > 1 && t.rows.every(r => /^[$€£¥]?[-−]?[\d,.]+\s?%?[a-z×]*$/i.test(r[i] ?? '')),
    );
  // One entry per distinct figure-in-sentence; prefer sourced ones first, keep document order.
  const seen = new Set(),
    unique = figures.filter(f => {
      const k = f.figure + f.sentence;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
  return {
    title: title ?? 'Untitled report',
    words,
    sections: outline,
    figures: unique,
    contrasts,
    questions,
    quotes,
    tables,
    sources: [...sources.values()],
  };
}

/** The evidence brief an author reads instead of the whole report. */
export function briefMarkdown(r, file) {
  const src = ids => (ids.length ? ids.map(i => `[${i}]`).join(' ') : '⚠ unsourced');
  const esc = s => String(s).replace(/\|/g, '\\|');
  const sourced = r.figures.filter(f => f.sources.length),
    unsourced = r.figures.filter(f => !f.sources.length);
  const out = [
    `# ${r.title}`,
    '',
    `Evidence brief generated from \`${file}\` (${r.words.toLocaleString('en-US')} words, ${r.sections.length} sections, ${r.figures.length} figures, ${r.sources.length} sources). Figures and sentences are quoted from the report; verify each against its source before publishing.`,
    '',
    "## Build a film, not the report's outline",
    '',
    '- Name the one question this report answers and the most surprising answer. That tension is the spine; the section order is not.',
    '- Choose 3–5 claims that carry the answer. Give each a different picture: a chart, a drawn mechanism (`canvas`), a plate, a stat on a colour block, poster type.',
    '- Where the report describes a process, a chain of causes or a place, draw it once as a `world` and let the camera travel between its stops instead of cutting to a new slide.',
    '- Give type a voice (`textMotion`: words for editorial, cascade for a hook) and keep held frames alive (loops, `particles`, a slow camera).',
    '- Open with the strongest figure or contradiction (below), not with context. Close on what it means for the viewer.',
    '- Show only figures with a source; mark estimates as estimates. ⚠ marks figures the report does not attribute.',
    '',
  ];
  out.push('## Figures', '', '| # | Figure | Claim | Section | Source |', '|---|---|---|---|---|');
  [...sourced, ...unsourced]
    .slice(0, 60)
    .forEach((f, i) =>
      out.push(
        `| ${i + 1} | **${esc(f.figure)}** | ${esc(f.sentence.length > 220 ? f.sentence.slice(0, 217) + '…' : f.sentence)} | ${esc(f.section)} | ${src(f.sources)} |`,
      ),
    );
  if (r.figures.length > 60) out.push('', `…${r.figures.length - 60} more in research.json.`);
  if (r.contrasts.length) {
    out.push(
      '',
      '## Tensions and turns',
      '',
      ...r.contrasts.slice(0, 20).map(c => `- ${c.sentence} ${c.sources.length ? src(c.sources) : ''}`.trimEnd()),
    );
  }
  if (r.questions.length) {
    out.push('', '## Questions the report raises', '', ...r.questions.slice(0, 12).map(q => `- ${q.sentence}`));
  }
  if (r.quotes.length) {
    out.push('', '## Quotations', '', ...r.quotes.slice(0, 12).map(q => `- “${q.text}” (${q.section})`));
  }
  if (r.tables.length) {
    out.push('', '## Tables (chart candidates)', '');
    r.tables.slice(0, 8).forEach((t, i) => {
      out.push(
        `${i + 1}. ${t.section}: ${t.headers.join(' · ')} (${t.rows.length} rows; numeric columns: ${t.headers.filter((_, j) => t.numeric[j]).join(', ') || 'none'})`,
      );
    });
  }
  out.push(
    '',
    '## Sections',
    '',
    ...r.sections.map(
      s =>
        `- ${'  '.repeat(Math.max(0, s.level - 2))}**${s.heading}** (${s.figures} figures) ${s.lead ? '— ' + (s.lead.length > 160 ? s.lead.slice(0, 157) + '…' : s.lead) : ''}`,
    ),
  );
  out.push('', '## Sources', '', ...r.sources.map(s => `- [${s.id}] ${s.title}${s.url ? ` — ${s.url}` : ''}`));
  return out.join('\n') + '\n';
}

/** Minimal HTML → markdown that keeps what the brief needs: headings, lists, quotes, links, tables. */
export function htmlToMarkdown(html) {
  const decode = s =>
    s
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;|&rsquo;/g, '’')
      .replace(/&ldquo;/g, '“')
      .replace(/&rdquo;/g, '”')
      .replace(/&mdash;/g, '—')
      .replace(/&ndash;/g, '–')
      .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)));
  let s = html.replace(/<(script|style|nav|footer|header|aside)[\s\S]*?<\/\1>/gi, '').replace(/<!--[\s\S]*?-->/g, '');
  s = s
    .replace(
      /<h([1-6])[^>]*>([\s\S]*?)<\/h\1>/gi,
      (_, n, t) => `\n\n${'#'.repeat(Number(n))} ${t.replace(/<[^>]+>/g, '').trim()}\n\n`,
    )
    .replace(
      /<a [^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi,
      (_, u, t) => `[${t.replace(/<[^>]+>/g, '').trim()}](${u})`,
    )
    .replace(/<li[^>]*>/gi, '\n- ')
    .replace(/<blockquote[^>]*>([\s\S]*?)<\/blockquote>/gi, (_, t) => `\n\n> ${t.replace(/<[^>]+>/g, '').trim()}\n\n`)
    .replace(
      /<tr[^>]*>([\s\S]*?)<\/tr>/gi,
      (_, r) =>
        `\n| ${[...r.matchAll(/<t[hd][^>]*>([\s\S]*?)<\/t[hd]>/gi)].map(m => m[1].replace(/<[^>]+>/g, '').trim()).join(' | ')} |`,
    )
    .replace(/<\/(p|div|section|article|table|ul|ol)>/gi, '\n\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '');
  return (
    decode(s)
      .replace(/[ \t]+\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim() + '\n'
  );
}

/** Read a report in any common document format as markdown. */
export function documentMarkdown(file) {
  const ext = path.extname(file).toLowerCase();
  if (['.md', '.markdown', '.txt', ''].includes(ext)) return fs.readFileSync(file, 'utf8');
  if (['.html', '.htm'].includes(ext)) return htmlToMarkdown(fs.readFileSync(file, 'utf8'));
  if (['.docx', '.doc', '.rtf', '.odt', '.webarchive'].includes(ext)) {
    const r = spawnSync('textutil', ['-convert', 'html', '-stdout', file], { encoding: 'utf8', maxBuffer: 1 << 28 });
    if (r.status !== 0)
      throw new Error(
        `Could not convert ${path.basename(file)} (macOS textutil). Export it as markdown, HTML or text.`,
      );
    return htmlToMarkdown(r.stdout);
  }
  if (ext === '.pdf') {
    const r = spawnSync('pdftotext', ['-layout', file, '-'], { encoding: 'utf8', maxBuffer: 1 << 28 });
    if (r.error || r.status !== 0)
      throw new Error('PDF input needs pdftotext (brew install poppler), or export the PDF as text/markdown.');
    return r.stdout;
  }
  throw new Error(`Unsupported document type ${ext}; use markdown, text, HTML, DOCX, RTF or PDF.`);
}

export function ingestMarkdown(root, file, { scaffold, playbook = 'research-digest' } = {}) {
  const source = documentMarkdown(file);
  const r = parseResearch(source);
  fs.mkdirSync(root, { recursive: true });
  const dir = path.join(root, 'source');
  fs.mkdirSync(dir, { recursive: true });
  fs.copyFileSync(file, path.join(dir, path.basename(file)));
  if (!/\.(md|markdown)$/i.test(file))
    fs.writeFileSync(path.join(dir, `${path.basename(file).replace(/\.[^.]+$/, '')}.md`), source);
  writeJSON(path.join(dir, 'research.json'), r);
  fs.writeFileSync(path.join(root, 'BRIEF.md'), briefMarkdown(r, `source/${path.basename(file)}`));
  if (scaffold && !fs.existsSync(path.join(root, 'storyboard.json'))) {
    const sb = scaffold(playbook, { title: r.title });
    if (r.sources.length)
      sb.sources = r.sources.map(s => ({ id: s.id, title: s.title, ...(s.url ? { url: s.url } : {}) }));
    writeJSON(path.join(root, 'storyboard.json'), sb);
  }
  return {
    title: r.title,
    figures: r.figures.length,
    sourced: r.figures.filter(f => f.sources.length).length,
    contrasts: r.contrasts.length,
    tables: r.tables.length,
    sources: r.sources.length,
  };
}

// ------------------------------------------------------------------ recordings

/** Timed words with optional speakers from common transcript JSON shapes. */
export function timedWords(input) {
  let words = Array.isArray(input)
    ? input
    : (input?.words ?? input?.segments?.flatMap(s => (s.words ?? []).map(w => ({ speaker: s.speaker, ...w }))));
  if (!words && input?.steps)
    words = input.steps
      .filter(s => s.type === 'model_output')
      .flatMap(s => s.content ?? [])
      .flatMap(c => c.annotations ?? [])
      .filter(a => a.type === 'word_info');
  if (!Array.isArray(words) || !words.length) throw new Error('No word timestamps found in the transcript JSON.');
  const secs = v => (typeof v === 'string' && /^\d+(\.\d+)?s$/.test(v) ? Number(v.slice(0, -1)) : Number(v));
  const out = [];
  for (const w of words) {
    const text = String(w.w ?? w.word ?? w.text ?? '').trim(),
      t0 = secs(w.t0 ?? w.start ?? w.start_offset),
      t1 = secs(w.t1 ?? w.end ?? w.end_offset);
    const speaker = w.speaker ?? w.speaker_id ?? w.spk ?? null;
    if (!text) continue;
    // Punctuation-only tokens join the previous word so beat text and timings stay aligned.
    if (!wordKey(text) && out.length) {
      out.at(-1).w += text;
      if (Number.isFinite(t1)) out.at(-1).t1 = Math.max(out.at(-1).t1 ?? 0, t1);
      continue;
    }
    if (!wordKey(text)) continue;
    // Recognizers leave some words untimed (WhisperX digits) or zero-length: keep them, fill below.
    const timed = Number.isFinite(t0) && Number.isFinite(t1) && t1 > t0;
    out.push({
      w: text,
      t0: timed ? t0 : null,
      t1: timed ? t1 : null,
      ...(timed ? {} : { estimated: true }),
      ...(speaker != null ? { speaker: String(speaker) } : {}),
    });
  }
  // Untimed words share the gap between their timed neighbours (and are flagged as estimates).
  for (let i = 0; i < out.length; i++) {
    if (out[i].t0 != null) continue;
    let j = i;
    while (j < out.length && out[j].t0 == null) j++;
    const from = i ? out[i - 1].t1 : 0,
      to = j < out.length ? out[j].t0 : from + 0.3 * (j - i),
      step = Math.max(0.02, (to - from) / (j - i));
    for (let k = i; k < j; k++) {
      out[k].t0 = from + step * (k - i);
      out[k].t1 = out[k].t0 + step;
    }
    i = j - 1;
  }
  for (let i = 1; i < out.length; i++) {
    if (out[i].t0 < out[i - 1].t1) out[i].t0 = out[i - 1].t1;
    if (out[i].t1 <= out[i].t0) out[i].t1 = out[i].t0 + 0.02;
  }
  return out;
}

/** Speaker turns from a script: JSON [{speaker, text}] or lines like "HOST: text". */
export function scriptTurns(input) {
  if (Array.isArray(input))
    return input.map(t => ({ speaker: String(t.speaker ?? t.role ?? t.name), text: String(t.text ?? t.line ?? '') }));
  const turns = [];
  for (const line of String(input).split(/\n+/)) {
    const m = line.match(/^\s*\**([\p{L}\p{N} ._-]{1,30}?)\**\s*:\s*(.+)$/u);
    if (m) turns.push({ speaker: m[1].trim(), text: m[2] });
    else if (turns.length && line.trim()) turns.at(-1).text += ' ' + line.trim();
  }
  if (!turns.length) throw new Error('No speaker turns found; use lines like "HOST: text" or JSON [{speaker, text}].');
  return turns;
}

/** Script words with their speakers; punctuation-only tokens join the previous word. */
export function scriptTokens(turns) {
  const out = [];
  for (const t of turns)
    for (const w of t.text.split(/\s+/).filter(Boolean)) {
      if (!wordKey(w)) {
        if (out.length) out.at(-1).w += w;
        continue;
      }
      out.push({ w, speaker: t.speaker });
    }
  return out;
}

/**
 * Words for a recording with a known script: the script's spelling and speakers, the
 * recognizer's timings. Words the recognizer never heard are interpolated and flagged.
 */
export function scriptedWords(heard, turns) {
  const tokens = scriptTokens(turns);
  const { words, interpolated, matched } = alignScript(
    tokens.map(t => t.w),
    heard,
  );
  return { words: words.map((w, k) => ({ ...w, speaker: tokens[k].speaker })), interpolated, matched };
}

/**
 * Group words into beats: a new beat at a speaker change, after a sentence or a pause once
 * the beat is long enough, or before it grows past `max` seconds (preferring a comma).
 */
export function segmentWords(words, { min = 2.2, target = 5, max = 8.5, pause = 0.55 } = {}) {
  const segs = [];
  let cur = [];
  for (const w of words) {
    const prev = cur.at(-1);
    if (prev) {
      const d = prev.t1 - cur[0].t0,
        gap = w.t0 - prev.t1;
      const sentence = /[.!?]["')\]”’]*$/.test(prev.w),
        clause = /[,;:—–]["')\]”’]*$/.test(prev.w);
      if (
        (w.speaker ?? null) !== (prev.speaker ?? null) ||
        (sentence && d >= min) ||
        (gap >= pause && d >= min) ||
        (clause && d >= target) ||
        w.t1 - cur[0].t0 > max
      ) {
        segs.push(cur);
        cur = [];
      }
    }
    cur.push(w);
  }
  if (cur.length) segs.push(cur);
  // Fold fragments under a second into the previous beat of the same speaker.
  for (let i = segs.length - 1; i > 0; i--) {
    const s = segs[i],
      p = segs[i - 1];
    if (s.at(-1).t1 - s[0].t0 < 1 && (s[0].speaker ?? null) === (p[0].speaker ?? null)) {
      p.push(...s);
      segs.splice(i, 1);
    }
  }
  return segs;
}

/** Frame-aligned cut points inside the pauses between beats, so slices tile the recording exactly. */
export function cutPoints(segs, duration, fps) {
  const cuts = [0];
  for (let i = 1; i < segs.length; i++) {
    const end = segs[i - 1].at(-1).t1,
      start = segs[i][0].t0,
      mid = (end + start) / 2;
    let t = Math.round(mid * fps) / fps;
    if (t < end && Math.ceil(end * fps) / fps <= start) t = Math.ceil(end * fps) / fps;
    if (t > start && Math.floor(start * fps) / fps >= end) t = Math.floor(start * fps) / fps;
    cuts.push(Math.max(t, cuts.at(-1) + 1 / fps));
  }
  cuts.push(Math.max(Math.ceil(duration * fps) / fps, cuts.at(-1) + 1 / fps));
  return cuts;
}

/**
 * Import a recording (podcast, interview, talk) as consecutive beats. The recording is cut
 * at frame-aligned points inside pauses, so the beats replay it exactly with no gaps;
 * timings from a word-level transcript are measured, not estimated.
 */
export async function ingestRecording(
  root,
  { audio, words: wordsInput, script, from = 0, to, fps = 30, vertical = false, speakers = {}, theme, title },
) {
  const P = paths(root);
  if (fs.existsSync(P.storyboard))
    throw new Error(`${root} already has a storyboard; ingest a recording into a new directory.`);
  if (!wordsInput)
    throw new Error(
      'Recording import needs word timestamps: pass --words words.json (WhisperX, Gemini, or {w,t0,t1,speaker} lists) or run with --transcribe.',
    );
  fs.mkdirSync(P.vo, { recursive: true });
  fs.mkdirSync(path.join(root, 'source'), { recursive: true });
  const master = path.join(root, 'source', 'recording.wav');
  await ffmpeg([
    '-y',
    ...(from ? ['-ss', String(from)] : []),
    ...(to != null ? ['-to', String(to)] : []),
    '-i',
    path.resolve(audio),
    '-vn',
    '-ac',
    '1',
    '-ar',
    '48000',
    '-c:a',
    'pcm_s16le',
    master,
  ]);
  const { rate, pcm } = readPCM(master);
  const duration = pcm.length / 2 / rate;
  const scripted = script ? scriptedWords(timedWords(wordsInput), scriptTurns(script)) : null;
  const labelled = scripted ? scripted.words : timedWords(wordsInput);
  const words = labelled
    .map(w => ({ ...w, t0: w.t0 - from, t1: w.t1 - from }))
    .filter(w => w.t0 >= -0.02 && w.t1 <= duration + 0.05)
    .map(w => ({ ...w, t0: Math.max(0, w.t0), t1: Math.min(duration, w.t1) }))
    .filter(w => w.t1 > w.t0);
  if (!words.length) throw new Error('No timed words fall inside the selected range.');
  const segs = segmentWords(words);
  const cuts = cutPoints(segs, duration, fps);
  const ids = new Set(segs.flatMap(s => s.map(w => w.speaker).filter(Boolean)));
  const cast = {};
  [...ids].forEach((id, i) => {
    const given = speakers[id] ?? {};
    cast[id] = {
      name: given.name ?? `Speaker ${id}`,
      ...(given.role ? { role: given.role } : {}),
      color: given.color ?? (i % 2 ? 'accent2' : 'accent'),
    };
  });
  const beats = segs.map((seg, i) => {
    const id = `s${String(i + 1).padStart(3, '0')}`,
      start = cuts[i],
      end = cuts[i + 1];
    const a = Math.round(start * rate),
      b = Math.min(pcm.length / 2, Math.round(end * rate));
    const slice = Buffer.alloc((Math.round(end * rate) - a) * 2);
    pcm.copy(slice, 0, a * 2, b * 2);
    const file = path.join(P.vo, `${id}.wav`);
    fs.writeFileSync(file, pcmToWav(slice, { sampleRate: rate }));
    const text = seg.map(w => w.w).join(' '),
      sliceDur = slice.length / 2 / rate;
    const timed = seg.map(w => ({
      w: w.w,
      t0: round(Math.max(0, w.t0 - start), 4),
      t1: round(Math.max(Math.min(sliceDur, w.t1 - start), Math.max(0, w.t0 - start) + 0.01), 4),
    }));
    // Interpolated words are estimates: a beat containing any is not labelled measured.
    const estimated = seg.filter(w => w.estimated).length;
    for (let k = 1; k < timed.length; k++) if (timed[k].t0 < timed[k - 1].t1) timed[k].t0 = timed[k - 1].t1;
    writeJSON(path.join(P.vo, `${id}.json`), {
      provider: 'imported',
      textHash: hashOf(text),
      text,
      duration: sliceDur,
      words: timed,
      alignment: {
        kind: estimated ? 'estimated' : 'measured',
        provider: script ? 'script+recognizer' : 'imported-transcript',
        audioHash: audioHash(file),
        ...(estimated ? { interpolatedWords: estimated } : {}),
      },
      source: { file: 'source/recording.wav', start: round(start + from, 4), end: round(end + from, 4) },
      createdAt: new Date().toISOString(),
    });
    const stamp = t =>
      `${String(Math.floor((t + from) / 60)).padStart(2, '0')}:${((t + from) % 60).toFixed(1).padStart(4, '0')}`;
    return {
      id,
      block: 'kinetic',
      vo: text,
      ...(seg[0].speaker ? { speaker: seg[0].speaker } : {}),
      note: `${stamp(start)}–${stamp(end)}`,
      props: { mode: 'highlight', align: 'center', maxWords: vertical ? 5 : 8 },
    };
  });
  const sb = {
    version: 2,
    title: title ?? path.basename(audio).replace(/\.[^.]+$/, ''),
    format: { preset: vertical ? 'vertical' : 'landscape', fps },
    theme: theme ?? 'midnight',
    motion: { preset: 'snappy', intensity: 0.7 },
    transition: 'cut',
    backdrop: 'glow',
    texture: { grain: 0.3, vignette: 0.4 },
    // Speech stays on screen when a beat becomes a picture: social pop captions on a vertical
    // clip, phrase captions on a plate otherwise (kinetic beats never double them).
    captions: vertical ? 'pop' : true,
    music: false,
    pacing: { continuous: true },
    ...(Object.keys(cast).length ? { speakers: cast } : {}),
    sources: [{ id: 'recording', title: `Recording: ${path.basename(audio)}` }],
    beats,
  };
  writeJSON(P.storyboard, sb);
  fs.writeFileSync(
    path.join(root, 'BRIEF.md'),
    `# ${sb.title}\n\nImported ${beats.length} beats (${round(duration, 1)} s) from \`${path.basename(audio)}\`${from ? ` starting at ${from}s` : ''}. Every beat plays its slice of the recording; cuts sit in pauses, so the beats replay it without gaps. Word timings are measured from the supplied transcript.\n\nEvery beat starts as kinetic captions. Keep that where the words are the picture; elsewhere, change the block (keep \`vo\`, \`speaker\` and \`note\`): pull quotes (\`kinetic\` stack, \`quote\`), the numbers they mention (with sources), drawn explanations (\`canvas\`), speaker plates. Captions (\`${sb.captions === 'pop' ? 'pop' : 'true'}\`) keep the words on screen under any picture. When a stretch explains one process or place, draw it as a canvas \`world\` and let the camera follow the conversation through it (\`clearframe world DIR\` shows the plan). Do not edit \`vo\`: it must match the recording.\n`,
  );
  return {
    beats: beats.length,
    duration: round(duration, 2),
    speakers: Object.keys(cast),
    words: words.length,
    ...(scripted ? { interpolated: scripted.interpolated } : {}),
  };
}
