import fs from 'node:fs';
import path from 'node:path';
import { loadViewerNotes, answerNote } from '../viewer/notes.mjs';
import { inside, pictureSize } from './tool-media.mjs';
import { voiceRecord } from './tool-json.mjs';
const TEXT_EXT = new Set([
  '.md',
  '.markdown',
  '.txt',
  '.csv',
  '.json',
  '.srt',
  '.vtt',
  '.docx',
  '.html',
  '.htm',
  '.rtf',
  '.pdf',
]);
const SKIP = new Set(['review', 'build', 'node_modules']);
import type { ToolOptions, ToolHandlers } from './contracts.mjs';
import type { ViewerNote } from '../viewer/contracts.mjs';
import { fail, sec, atomic } from './tool-common.mjs';

function documentNames(name: string | undefined): string[] | null {
  if (name === 'brief') return ['brief.md', 'BRIEF.md'];
  return name === 'direction' ? ['DIRECTION.md'] : null;
}
function pinDescription(note: ViewerNote): string {
  if (!note.where) return '';
  const on = note.on ? `, on “${note.on}”` : '';
  return ` · pinned ${note.where} of the frame${on}`;
}

export function createFilesTools(_options: ToolOptions): ToolHandlers {
  return {
    notes({ dir, input }) {
      if (input.answer) {
        const a = input.answer,
          n = answerNote(dir, String(a.id ?? ''), {
            said: a.said,
            revision: a.revision,
          });
        if (!n) throw fail('The note could not be read after answering it.');
        return {
          content: `${n.id} marked as acted on: “${n.answer}”. The person decides whether it is done.`,
          metadata: { summary: `Answered note ${n.id}` },
        };
      }
      const all = loadViewerNotes(dir).filter((n) => input.all || !n.resolved);
      return {
        content:
          all
            .map(
              (n) =>
                `${n.id} [${n.state}] ${n.version ?? ''}${n.at != null ? ` at ${sec(n.at)}` : ' (whole film)'}${pinDescription(n)}${n.element ? ` element ${n.element}` : ''}: ${n.text}${n.by ? ` — ${n.by}` : ''}${n.answer ? `\n   ↳ you answered: ${n.answer}` : ''}${n.replies.map((r) => `\n   ↳ ${r.by ?? ''}: ${r.text}`).join('')}`,
            )
            .join('\n') || 'No review notes.',
        metadata: {
          summary: `${all.length} note${all.length === 1 ? '' : 's'}`,
        },
      };
    },

    async files({ dir, input }) {
      if (input.read) {
        const file = inside(dir, input.read),
          ext = path.extname(file).toLowerCase();
        if (!fs.existsSync(file) || !fs.statSync(file).isFile())
          throw fail(`No file ${input.read}.`);
        if (!TEXT_EXT.has(ext))
          throw fail(
            'That file is not a readable document (Markdown, text, CSV, JSON, captions, DOCX, HTML, RTF or PDF).',
          );
        if (fs.statSync(file).size > 25e6)
          throw fail('That document is larger than 25 MB.');
        let text;
        if (
          /^assets\/vo\/.*\.json$/.test(
            path.relative(dir, file).split(path.sep).join('/'),
          )
        )
          text = voiceRecord(fs.readFileSync(file, 'utf8'));
        else if (
          ['.md', '.markdown', '.txt', '.json', '.srt', '.vtt'].includes(ext)
        )
          text = fs.readFileSync(file, 'utf8');
        else {
          const { documentMarkdown } = await import('../ingest.mjs');
          text = documentMarkdown(file);
        }
        return {
          content:
            text.length > 120000
              ? `${text.slice(0, 120000)}\n\n[Truncated: ${text.length.toLocaleString('en-US')} characters in all.]`
              : text,
          metadata: { summary: `Read ${input.read}` },
        };
      }
      const out: string[] = [];
      const walk = (d: string, depth: number): void => {
        for (const e of fs
          .readdirSync(d, { withFileTypes: true })
          .sort((a, b) => a.name.localeCompare(b.name))) {
          if (
            e.name.startsWith('.') ||
            e.isSymbolicLink() ||
            (depth === 0 && SKIP.has(e.name)) ||
            out.length >= 400
          )
            continue;
          const f = path.join(d, e.name);
          if (e.isDirectory()) {
            if (depth < 5) walk(f, depth + 1);
          } else {
            const px =
              /\.(png|jpe?g|gif|webp)$/i.test(e.name) && pictureSize(f);
            out.push(
              `${path.relative(dir, f)} (${px ? `${px.width}×${px.height} px, ` : ''}${Math.max(1, Math.round(fs.statSync(f).size / 1024))} KB)`,
            );
          }
        }
      };
      walk(dir, 0);
      return {
        content: out.join('\n') || 'The project has no files yet.',
        metadata: { summary: `${out.length} files` },
      };
    },

    write({ dir, input }) {
      if (
        typeof input.text !== 'string' ||
        !input.text.trim() ||
        input.text.length > 100000
      )
        throw fail('Write the new Markdown (up to 100,000 characters).');
      const names = documentNames(input.file);
      if (!names) throw fail('Write the brief or the direction notes.');
      const file = path.join(
        dir,
        names.find((n) => fs.existsSync(path.join(dir, n))) ?? names[0],
      );
      atomic(file, input.text.replace(/\s*$/, '\n'));
      return {
        content: `Saved ${path.basename(file)}.`,
        metadata: { summary: `Rewrote ${path.basename(file)}` },
      };
    },
  };
}
