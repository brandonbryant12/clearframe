// A research report in markdown, read into the evidence a film is built from: sections,
// figures, tensions, questions, quotes, tables and sources.

export interface ResearchSource {
  id: string;
  title: string;
  url: string | null;
}

export interface ResearchFigure {
  figure: string;
  value: number;
  unit: string;
  sentence: string;
  section: string;
  sources: string[];
}

export interface ResearchContrast {
  sentence: string;
  section: string;
  sources: string[];
}

export interface ResearchQuestion {
  sentence: string;
  section: string;
}

export interface ResearchQuote {
  text: string;
  section: string;
}

export interface ResearchTable {
  headers: string[];
  rows: string[][];
  section: string;
  numeric: boolean[];
}

export interface ResearchOutline {
  heading: string;
  level: number;
  lead: string | null;
  figures: number;
}

export interface Research {
  title: string;
  words: number;
  sections: ResearchOutline[];
  figures: ResearchFigure[];
  contrasts: ResearchContrast[];
  questions: ResearchQuestion[];
  quotes: ResearchQuote[];
  tables: ResearchTable[];
  sources: ResearchSource[];
}

export interface ParsedSection {
  heading: string;
  level: number;
  paragraphs: string[];
  references?: boolean;
}

export interface TableDraft {
  headers: string[];
  rows: string[][];
}
