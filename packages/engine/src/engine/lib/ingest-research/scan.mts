import type {
  ParsedSection,
  TableDraft,
  ResearchQuote,
  ResearchSource,
} from './contracts.mjs';
import { linksOf, plain, referencesHeading } from './markdown.mjs';

/** One pass over the report's lines: sections with their paragraphs, tables, block quotes and sources. */
export class ReportScan {
  title: string | null;
  readonly sections: ParsedSection[] = [];
  readonly tables: (TableDraft & { section: string })[] = [];
  readonly quotes: ResearchQuote[] = [];
  readonly sources = new Map<string, ResearchSource>();
  private section: ParsedSection = {
    heading: 'Introduction',
    level: 1,
    paragraphs: [],
  };
  private inCode = false;
  private table: TableDraft | null = null;
  private para: string[] = [];

  constructor(title: string | null) {
    this.title = title;
  }

  addSource(id: string, value: string): void {
    // The first link is the source; its title is the entry's text with links reduced to words.
    const url = (
      linksOf(value)[0]?.url ?? value.match(/https?:\/\/\S+/)?.[0]
    )?.replace(/[)>.,]+$/, '');
    const t = plain(value)
      .replace(/https?:\/\/\S+/g, '')
      .replace(/\(\s*\)/g, '')
      .replace(/^[-–—:.,;\s]+|[-–—:.,;\s]+$/g, '');
    if (!this.sources.has(id))
      this.sources.set(id, { id, title: t || url || id, url: url ?? null });
  }

  line(raw: string): void {
    const line = raw.trimEnd();
    if (/^\s*```/.test(line)) {
      this.inCode = !this.inCode;
      this.flush();
      return;
    }
    if (this.inCode) return;
    if (
      this.heading(line) ||
      this.footnote(line) ||
      this.definition(line) ||
      this.tableRow(line)
    )
      return;
    this.endTable();
    if (!line.trim()) {
      this.flush();
      return;
    }
    if (this.quote(line) || this.listItem(line) || this.reference(line)) return;
    this.para.push(line.trim());
  }

  finish(): void {
    this.flush();
    this.endTable();
    this.sections.push(this.section);
  }

  private flush(): void {
    if (!this.para.length) return;
    this.section.paragraphs.push(this.para.join(' '));
    this.para = [];
  }

  private endTable(): void {
    if (!this.table) return;
    if (this.table.rows.length)
      this.tables.push({ ...this.table, section: this.section.heading });
    this.table = null;
  }

  private heading(line: string): boolean {
    const heading = line.match(/^(#{1,6})\s+(.*)$/);
    if (!heading) return false;
    this.flush();
    this.endTable();
    const h = plain(heading[2]);
    if (!this.title && heading[1].length === 1) {
      this.title = h;
      return true;
    }
    if (
      this.section.paragraphs.length ||
      this.section.heading !== 'Introduction'
    )
      this.sections.push(this.section);
    this.section = {
      heading: h,
      level: heading[1].length,
      paragraphs: [],
      references: referencesHeading(h),
    };
    return true;
  }

  private footnote(line: string): boolean {
    const foot = line.match(/^\[\^([^\]]+)\]:\s*(.+)$/);
    if (!foot) return false;
    this.flush();
    this.addSource(foot[1], foot[2]);
    return true;
  }

  private definition(line: string): boolean {
    const def = line.match(/^\[([^\]]+)\]:\s*(https?:\S+)(.*)$/);
    if (!def) return false;
    this.addSource(def[1], `${def[3] || def[1]} ${def[2]}`);
    return true;
  }

  private tableRow(line: string): boolean {
    if (!/^\s*\|/.test(line)) return false;
    this.flush();
    const cells = line
      .replace(/^\s*\||\|\s*$/g, '')
      .split('|')
      .map((c) => plain(c));
    if (cells.every((c) => /^:?-{2,}:?$/.test(c.replace(/\s/g, ''))))
      return true;
    if (!this.table) this.table = { headers: cells, rows: [] };
    else this.table.rows.push(cells);
    return true;
  }

  private quote(line: string): boolean {
    const quote = line.match(/^>\s?(.*)$/);
    if (!quote) return false;
    this.flush();
    const q = plain(quote[1])
      .replace(/^["“]/, '')
      .replace(/["”](?=\s*(?:[—–-]|$))/g, '');
    if (q.length > 20)
      this.quotes.push({ text: q, section: this.section.heading });
    return true;
  }

  private listItem(line: string): boolean {
    const item = line.match(/^\s*(?:[-*+]|(\d+)[.)])\s+(.*)$/);
    if (!item) return false;
    this.flush();
    // Numbered entries under a references heading, or "[n] ... http" lines, are sources.
    const cited = item[2].match(/^\[(\d+)\]\s*(.*)$/);
    if (this.section.references || cited) {
      const number: string | undefined = item[1];
      this.addSource(
        cited?.[1] ?? number ?? String(this.sources.size + 1),
        cited?.[2] ?? item[2],
      );
      return true;
    }
    this.section.paragraphs.push(item[2]);
    return true;
  }

  private reference(line: string): boolean {
    const bracketRef = line.match(/^\s*\[(\d+)\]\s+(.*https?:\/\/.*)$/);
    if (!bracketRef && !this.section.references) return false;
    this.flush();
    this.addSource(
      bracketRef?.[1] ?? String(this.sources.size + 1),
      bracketRef?.[2] ?? line,
    );
    return true;
  }
}
