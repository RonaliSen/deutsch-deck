// The word list as a CSV file: the same columns and format the import
// reads (see csv-import.ts), so an export can be imported again as is.
// Plain functions, no Angular - tested as input -> output.

import { Word } from '../models/word.model';
import { formatCsv } from './csv';
import { CSV_HEADER } from './csv-import';

/** German, English, Article, Level - one row per word, in the given order. */
export function wordsToCsv(
  words: readonly Pick<Word, 'german' | 'english' | 'gender' | 'level'>[],
): string {
  return formatCsv([
    CSV_HEADER,
    ...words.map((word) => [word.german, word.english, word.gender ?? '', word.level]),
  ]);
}

/** "deutschdeck-words-2026-03-10.csv" - the local date, so files sort by day. */
export function csvExportFileName(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `deutschdeck-words-${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}.csv`;
}
