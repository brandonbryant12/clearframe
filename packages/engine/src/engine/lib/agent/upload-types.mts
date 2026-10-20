export const DOCS = new Set([
  '.md',
  '.markdown',
  '.txt',
  '.pdf',
  '.docx',
  '.html',
  '.htm',
  '.rtf',
  '.csv',
  '.json',
]);
/** What the `start` intake can read (ingest.documentMarkdown); other DOCS are kept, not ingested. */
export const INTAKE = new Set([
  '.md',
  '.markdown',
  '.txt',
  '.pdf',
  '.docx',
  '.html',
  '.htm',
  '.rtf',
  '.csv',
]);
export const MEDIA = new Set([
  '.png',
  '.jpg',
  '.jpeg',
  '.webp',
  '.gif',
  '.svg',
  '.mp4',
  '.mov',
  '.webm',
  '.wav',
  '.mp3',
  '.m4a',
  '.srt',
  '.vtt',
]);
export const MAX_UPLOAD = { doc: 25e6, media: 500e6 };
