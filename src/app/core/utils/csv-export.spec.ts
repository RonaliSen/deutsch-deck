import { Word } from '../models/word.model';
import { decodeCsvBytes } from './csv';
import { csvExportFileName, wordsToCsv } from './csv-export';
import { buildCsvPreview } from './csv-import';

function word(overrides: Partial<Word>): Word {
  return {
    id: 1,
    german: 'Haus',
    english: 'house',
    level: 'A1',
    topic: 'home',
    box: 3,
    dueAt: 0,
    createdAt: 0,
    ...overrides,
  };
}

describe('wordsToCsv', () => {
  it('writes the import’s header, then one row per word in order', () => {
    const csv = wordsToCsv([
      word({ german: 'Tisch', english: 'table', gender: 'der', level: 'A1' }),
      word({ german: 'laufen', english: 'to run', level: 'A2' }),
    ]);
    expect(csv).toBe('German,English,Article,Level\r\nTisch,table,der,A1\r\nlaufen,to run,,A2\r\n');
  });

  it('leaves out everything but the four columns (topic, plural, progress)', () => {
    const csv = wordsToCsv([word({ plural: 'Häuser', topic: 'home', box: 5 })]);
    expect(csv).toBe('German,English,Article,Level\r\nHaus,house,,A1\r\n');
  });

  it('writes just the header for an empty list - a template to fill in', () => {
    expect(wordsToCsv([])).toBe('German,English,Article,Level\r\n');
  });

  it('quotes values the import would otherwise split', () => {
    const csv = wordsToCsv([word({ german: 'gehen, laufen', english: 'to say "go"' })]);
    expect(csv.split('\r\n')[1]).toBe('"gehen, laufen","to say ""go""",,A1');
  });

  it('round-trips through the import unchanged, BOM and all', () => {
    const words = [
      word({ german: 'Tür', english: 'door', gender: 'die', level: 'A2' }),
      word({ german: 'gehen, laufen', english: 'to go, to walk', level: 'A1' }),
      word({ german: 'sagen', english: 'to say "hello"', level: 'B1' }),
      word({ german: 'Straße', english: 'street;\nroad', gender: 'die', level: 'A1' }),
      word({ german: 'Mädchen', english: 'girl', gender: 'das', level: 'A1' }),
    ];
    // What the download writes: a UTF-8 byte-order mark, then the text.
    const bytes = new TextEncoder().encode('\uFEFF' + wordsToCsv(words));

    const preview = buildCsvPreview(decodeCsvBytes(bytes));

    expect(preview.ok).toBe(true);
    if (preview.ok) {
      expect(preview.errors).toEqual([]);
      expect(preview.ignoredColumns).toEqual([]);
      expect(preview.words.map(({ row, ...rest }) => rest)).toEqual(
        words.map(({ german, english, gender, level }) => ({
          german,
          english,
          ...(gender ? { gender } : {}),
          level,
        })),
      );
    }
  });
});

describe('csvExportFileName', () => {
  it('names the file after the local date, zero-padded', () => {
    expect(csvExportFileName(new Date(2026, 2, 5, 23, 59))).toBe(
      'deutschdeck-words-2026-03-05.csv',
    );
    expect(csvExportFileName(new Date(2026, 10, 15))).toBe('deutschdeck-words-2026-11-15.csv');
  });
});
