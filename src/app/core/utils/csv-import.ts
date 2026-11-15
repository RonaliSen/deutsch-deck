// Turns the text of an imported CSV into a preview: the rows that are
// valid words, the rows that aren't (and why), or - when the file as a
// whole can't be used - one message saying what to fix.
//
// Same rules as the Add word dialog: German and English are required,
// the article is optional (der/die/das), the level is A1, A2 or B1.
// Plain functions, no Angular - tested as input -> output.

import { Gender, Level, Word, WordInput } from '../models/word.model';
import { CsvDelimiter, CsvRecord, detectDelimiter, parseCsv } from './csv';
import { wordKey } from './word-key';

export type CsvColumn = 'german' | 'english' | 'article' | 'level';

/** Header names, matched case-insensitively; the first is the display name. */
const COLUMN_NAMES: Record<CsvColumn, readonly string[]> = {
  german: ['German'],
  english: ['English'],
  article: ['Article', 'Articles'],
  level: ['Level'],
};
const REQUIRED: readonly CsvColumn[] = ['german', 'english', 'level'];
const LEVELS: readonly Level[] = ['A1', 'A2', 'B1'];
const GENDERS: readonly Gender[] = ['der', 'die', 'das'];

/** The columns in file order, by display name - what export writes as its header row. */
export const CSV_HEADER: readonly string[] = (
  ['german', 'english', 'article', 'level'] as const
).map((column) => COLUMN_NAMES[column][0]);

/** The header row a file needs, as shown in messages. */
export const CSV_HEADER_HINT = CSV_HEADER.join(', ');

export interface CsvWordRow {
  /** Spreadsheet row number (header = 1), for pointing back into the file. */
  row: number;
  german: string;
  english: string;
  gender?: Gender;
  level: Level;
}

export interface CsvRowError {
  row: number;
  /** Every problem in the row, so one pass of fixes is enough. */
  problems: string[];
}

export type CsvPreview =
  | {
      ok: true;
      words: CsvWordRow[];
      errors: CsvRowError[];
      /** Header names that aren't one of the supported columns, as written. */
      ignoredColumns: string[];
      delimiter: CsvDelimiter;
    }
  | { ok: false; message: string };

const NO_TEXT = `This file has no text in it. The first row should be: ${CSV_HEADER_HINT}.`;

export function buildCsvPreview(text: string): CsvPreview {
  if (text.trim() === '') {
    return fail(NO_TEXT);
  }

  const delimiter = detectDelimiter(text);
  const parsed = parseCsv(text, delimiter);
  if (!parsed.ok) {
    return fail(
      `Row ${parsed.row} opens a quote (") that is never closed, so the rest of the file ` +
        `can’t be read. Add the closing quote, or remove the opening one.`,
    );
  }

  // The header is the first row with anything in it.
  const records = parsed.records.filter((record) => !isBlank(record));
  const [header, ...rows] = records;
  if (!header) {
    return fail(NO_TEXT); // only delimiters, e.g. ",,,"
  }

  const columns = mapHeader(header);
  if (!columns.ok) {
    return columns;
  }
  if (rows.length === 0) {
    return fail('There are no words below the header row. Add one word per row.');
  }

  const words: CsvWordRow[] = [];
  const errors: CsvRowError[] = [];
  for (const record of rows) {
    const result = readRow(record, columns.index, header.fields.length);
    if ('problems' in result) {
      errors.push(result);
    } else {
      words.push(result);
    }
  }
  return { ok: true, words, errors, ignoredColumns: columns.ignored, delimiter };
}

function mapHeader(
  header: CsvRecord,
):
  | { ok: true; index: Partial<Record<CsvColumn, number>>; ignored: string[] }
  | { ok: false; message: string } {
  const index: Partial<Record<CsvColumn, number>> = {};
  const ignored: string[] = [];

  for (const [position, raw] of header.fields.entries()) {
    const name = raw.trim();
    const column = columnFor(name);
    if (!column) {
      if (name) {
        ignored.push(name);
      }
      continue;
    }
    if (index[column] !== undefined) {
      return fail(
        `The ${display(column)} column appears twice in the header row. Keep one and remove the other.`,
      );
    }
    index[column] = position;
  }

  const missing = REQUIRED.filter((column) => index[column] === undefined);
  if (missing.length > 0) {
    const found = header.fields.map((f) => f.trim()).filter(Boolean);
    // Nothing recognised at all: most likely the header row is missing
    // and the first row is already a word.
    const hint =
      missing.length === REQUIRED.length
        ? ` The first row should name the columns: ${CSV_HEADER_HINT}.`
        : '';
    return fail(
      `Missing ${missing.length === 1 ? 'column' : 'columns'}: ${list(missing.map(display))}.` +
        hint +
        (found.length ? ` The first row has: ${quoteList(found)}.` : ''),
    );
  }
  return { ok: true, index, ignored };
}

function readRow(
  record: CsvRecord,
  index: Partial<Record<CsvColumn, number>>,
  headerLength: number,
): CsvWordRow | CsvRowError {
  const { row, fields } = record;
  const value = (column: CsvColumn) => {
    const position = index[column];
    return position === undefined ? '' : (fields[position] ?? '').trim();
  };
  // More values than columns almost always means an unquoted comma inside
  // a value ("to go, to walk"), which shifts everything after it - so it's
  // the only problem reported: "Article 'to walk' isn't valid" and the like
  // would point at mistakes that aren't there. Blank extras (a trailing
  // comma) are harmless.
  const extra = fields.slice(headerLength).filter((f) => f.trim() !== '');
  if (extra.length > 0) {
    return {
      row,
      problems: [
        `It has ${headerLength + extra.length} values but the header has ${headerLength}. ` +
          `If a value contains a comma, put the value in double quotes.`,
      ],
    };
  }

  const problems: string[] = [];
  const german = value('german');
  const english = value('english');
  const article = value('article').toLowerCase();
  const level = value('level').toUpperCase();

  if (!german) {
    problems.push('German is empty.');
  }
  if (!english) {
    problems.push('English is empty.');
  }
  if (article && !GENDERS.includes(article as Gender)) {
    problems.push(
      `Article “${value('article')}” isn’t valid. Use der, die or das, or leave it empty.`,
    );
  }
  if (!level) {
    problems.push('Level is empty. Use A1, A2 or B1.');
  } else if (!LEVELS.includes(level as Level)) {
    problems.push(`Level “${value('level')}” isn’t valid. Use A1, A2 or B1.`);
  }

  if (problems.length > 0) {
    return { row, problems };
  }
  return {
    row,
    german,
    english,
    ...(article ? { gender: article as Gender } : {}),
    level: level as Level,
  };
}

function columnFor(name: string): CsvColumn | undefined {
  const lower = name.toLowerCase();
  return (Object.keys(COLUMN_NAMES) as CsvColumn[]).find((column) =>
    COLUMN_NAMES[column].some((alias) => alias.toLowerCase() === lower),
  );
}

const display = (column: CsvColumn) => COLUMN_NAMES[column][0];
const isBlank = (record: CsvRecord) => record.fields.every((f) => f.trim() === '');
const fail = (message: string) => ({ ok: false as const, message });

/** "A", "A and B", "A, B and C". */
function list(items: string[]): string {
  return items.length <= 1
    ? items.join('')
    : `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

/** Quoted, and cut short after a few - a missing header means this is a whole word row. */
function quoteList(items: string[], max = 4): string {
  const shown = items.slice(0, max).map((item) => `“${item}”`);
  return items.length > max ? `${shown.join(', ')}, …` : shown.join(', ');
}

// --- Planning the import ---

/** Topic given to every imported word - the file has no topic column yet. */
export const IMPORT_TOPIC = 'other';

/** Why a valid row will be skipped: it's already a word, or an earlier row had it. */
export type CsvDuplicate = { of: 'existing' } | { of: 'row'; row: number };

export interface CsvImportPlan {
  /** Valid rows that aren't duplicates - what "Import N words" adds. */
  newWords: CsvWordRow[];
  /** Valid rows that will be skipped, keyed by row number. */
  duplicates: Map<number, CsvDuplicate>;
}

/**
 * Splits a preview's valid rows into new words and duplicates (same German
 * and English, see wordKey) - of an existing word, or of an earlier row.
 * The first of several identical rows is the one kept.
 */
export function planCsvImport(
  words: readonly CsvWordRow[],
  existing: readonly Pick<Word, 'german' | 'english'>[],
): CsvImportPlan {
  const known = new Set(existing.map(wordKey));
  const firstRowWith = new Map<string, number>();
  const newWords: CsvWordRow[] = [];
  const duplicates = new Map<number, CsvDuplicate>();

  for (const word of words) {
    const key = wordKey(word);
    const earlierRow = firstRowWith.get(key);
    if (known.has(key)) {
      duplicates.set(word.row, { of: 'existing' });
    } else if (earlierRow !== undefined) {
      duplicates.set(word.row, { of: 'row', row: earlierRow });
    } else {
      firstRowWith.set(key, word.row);
      newWords.push(word);
    }
  }
  return { newWords, duplicates };
}

/** A previewed row as the word the store saves - topic defaults to IMPORT_TOPIC. */
export function toWordInput({ german, english, gender, level }: CsvWordRow): WordInput {
  return { german, english, ...(gender ? { gender } : {}), level, topic: IMPORT_TOPIC };
}
