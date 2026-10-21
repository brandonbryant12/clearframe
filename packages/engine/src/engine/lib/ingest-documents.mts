// Reports in any common document format, read as markdown for the research parser.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const ENTITIES: readonly (readonly [RegExp, string])[] = [
  [/&nbsp;/g, ' '],
  [/&amp;/g, '&'],
  [/&lt;/g, '<'],
  [/&gt;/g, '>'],
  [/&quot;/g, '"'],
  [/&#39;|&rsquo;/g, '’'],
  [/&ldquo;/g, '“'],
  [/&rdquo;/g, '”'],
  [/&mdash;/g, '—'],
  [/&ndash;/g, '–'],
];
const decode = (s: string): string =>
  ENTITIES.reduce(
    (text, [pattern, value]) => text.replace(pattern, value),
    s,
  ).replace(/&#(\d+);/g, (_: string, n: string) =>
    String.fromCodePoint(Number(n)),
  );
const tags = (t: string): string => t.replace(/<[^>]+>/g, '').trim();

/** Minimal HTML → markdown that keeps what the brief needs: headings, lists, quotes, links, tables. */
export function htmlToMarkdown(html: string): string {
  let s = html
    .replace(/<(script|style|nav|footer|header|aside)[\s\S]*?<\/\1>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '');
  s = s
    .replace(
      /<h([1-6])[^>]*>([\s\S]*?)<\/h\1>/gi,
      (_: string, n: string, t: string) =>
        `\n\n${'#'.repeat(Number(n))} ${tags(t)}\n\n`,
    )
    .replace(
      /<a [^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi,
      (_: string, u: string, t: string) => `[${tags(t)}](${u})`,
    )
    .replace(/<li[^>]*>/gi, '\n- ')
    .replace(
      /<blockquote[^>]*>([\s\S]*?)<\/blockquote>/gi,
      (_: string, t: string) => `\n\n> ${tags(t)}\n\n`,
    )
    .replace(
      /<tr[^>]*>([\s\S]*?)<\/tr>/gi,
      (_: string, r: string) =>
        `\n| ${[...r.matchAll(/<t[hd][^>]*>([\s\S]*?)<\/t[hd]>/gi)].map((m) => tags(m[1])).join(' | ')} |`,
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

/** RFC 4180-style rows; blank rows are skipped and an unclosed quote is refused. */
class CsvReader {
  readonly rows: string[][] = [];
  readonly row: string[] = [];
  cell = '';
  quoted = false;
  consume(input: string, index: number): number {
    const ch = input[index];
    if (ch === '"') return this.quote(input, index);
    if (this.quoted || ![',', '\n', '\r'].includes(ch)) {
      this.cell += ch;
      return index;
    }
    this.row.push(this.cell);
    this.cell = '';
    if (ch === ',') return index;
    if (this.row.some((value) => value.trim()))
      this.rows.push(this.row.splice(0));
    else this.row.length = 0;
    return ch === '\r' && input[index + 1] === '\n' ? index + 1 : index;
  }
  quote(input: string, index: number): number {
    if (this.quoted && input[index + 1] === '"') {
      this.cell += '"';
      return index + 1;
    }
    this.quoted = !this.quoted;
    return index;
  }
  finish(): string[][] {
    if (this.quoted) throw new Error('CSV has an unclosed quoted cell.');
    if (this.cell || this.row.length) {
      this.row.push(this.cell);
      this.rows.push(this.row);
    }
    return this.rows;
  }
}
function csvRows(input: string): string[][] {
  const csv = new CsvReader();
  for (let i = 0; i < input.length; i++) i = csv.consume(input, i);
  return csv.finish();
}

function csvMarkdown(file: string, ext: string): string {
  const rows = csvRows(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));
  if (
    !rows.length ||
    rows[0].some((v) => !v.trim()) ||
    rows.some((r) => r.length !== rows[0].length)
  )
    throw new Error(
      'CSV needs nonempty headers and the same number of cells in every row.',
    );
  const line = (r: string[]): string =>
    '| ' +
    r.map((v) => v.replace(/\|/g, '\\|').replace(/[\r\n]+/g, ' ')).join(' | ') +
    ' |';
  return `# ${path.basename(file, ext)}\n\n${line(rows[0])}\n${line(rows[0].map(() => '---'))}\n${rows.slice(1).map(line).join('\n')}\n`;
}

/** Read a report in any common document format as markdown. */
export function documentMarkdown(file: string): string {
  const ext = path.extname(file).toLowerCase();
  if (ext === '.csv') return csvMarkdown(file, ext);
  if (['.md', '.markdown', '.txt', ''].includes(ext))
    return fs.readFileSync(file, 'utf8');
  if (['.html', '.htm'].includes(ext))
    return htmlToMarkdown(fs.readFileSync(file, 'utf8'));
  if (['.docx', '.doc', '.rtf', '.odt', '.webarchive'].includes(ext)) {
    const r = spawnSync('textutil', ['-convert', 'html', '-stdout', file], {
      encoding: 'utf8',
      maxBuffer: 1 << 28,
    });
    if (r.status !== 0)
      throw new Error(
        `Could not convert ${path.basename(file)} (macOS textutil). Export it as markdown, HTML or text.`,
      );
    return htmlToMarkdown(r.stdout);
  }
  if (ext === '.pdf') {
    const r = spawnSync('pdftotext', ['-layout', file, '-'], {
      encoding: 'utf8',
      maxBuffer: 1 << 28,
    });
    if (r.error || r.status !== 0)
      throw new Error(
        'PDF input needs pdftotext (brew install poppler), or export the PDF as text/markdown.',
      );
    return r.stdout;
  }
  throw new Error(
    `Unsupported document type ${ext}; use markdown, text, CSV, HTML, DOCX, RTF or PDF.`,
  );
}
