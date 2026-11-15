import {
  CsvPreview,
  CsvWordRow,
  IMPORT_TOPIC,
  buildCsvPreview,
  planCsvImport,
  toWordInput,
} from './csv-import';

const HEADER = 'German,English,Article,Level';

/** Narrows to a usable preview, failing the test with the message otherwise. */
function preview(text: string): Extract<CsvPreview, { ok: true }> {
  const result = buildCsvPreview(text);
  if (!result.ok) {
    throw new Error(`expected a preview, got: ${result.message}`);
  }
  return result;
}

function failure(text: string): string {
  const result = buildCsvPreview(text);
  if (result.ok) {
    throw new Error('expected the file to be rejected');
  }
  return result.message;
}

describe('buildCsvPreview - valid files', () => {
  it('reads each row into a word, with its spreadsheet row number', () => {
    const result = preview(`${HEADER}\nTisch,table,der,A1\nlaufen,to run,,A2\n`);

    expect(result.words).toEqual([
      { row: 2, german: 'Tisch', english: 'table', gender: 'der', level: 'A1' },
      { row: 3, german: 'laufen', english: 'to run', level: 'A2' },
    ]);
    expect(result.errors).toEqual([]);
    expect(result.ignoredColumns).toEqual([]);
    expect(result.delimiter).toBe(',');
  });

  it('keeps commas and quotes inside quoted values', () => {
    const result = preview(
      `${HEADER}\n"gehen, laufen","to go, to walk",,A1\n"sagen","to say ""hi""",,A1`,
    );

    expect(result.words.map((w) => [w.german, w.english])).toEqual([
      ['gehen, laufen', 'to go, to walk'],
      ['sagen', 'to say "hi"'],
    ]);
  });

  it('matches headers in any order and case, and accepts "Articles"', () => {
    const result = preview('level,ARTICLES,english,German\nb1,DIE,door,Tür');

    expect(result.words).toEqual([
      { row: 2, german: 'Tür', english: 'door', gender: 'die', level: 'B1' },
    ]);
  });

  it('trims spaces around values and headers', () => {
    const result = preview(' German , English , Article , Level \n  Haus  , house , das , a1 ');
    expect(result.words[0]).toEqual({
      row: 2,
      german: 'Haus',
      english: 'house',
      gender: 'das',
      level: 'A1',
    });
  });

  it('works without an Article column - every word just has no article', () => {
    const result = preview('German,English,Level\nschnell,fast,A1');
    expect(result.words).toEqual([{ row: 2, german: 'schnell', english: 'fast', level: 'A1' }]);
  });

  it('reads semicolon-separated files (German Excel)', () => {
    const result = preview('German;English;Article;Level\nHaus;house, home;das;A1');
    expect(result.delimiter).toBe(';');
    expect(result.words[0]).toMatchObject({ german: 'Haus', english: 'house, home' });
  });

  it('lists unsupported columns as ignored, and skips blank header cells', () => {
    const result = preview('German,English,Level,Topic,Plural,\nHaus,house,A1,home,Häuser,');
    expect(result.ignoredColumns).toEqual(['Topic', 'Plural']);
    expect(result.words).toHaveLength(1);
  });

  it('skips blank rows without counting them as errors, keeping row numbers true', () => {
    const result = preview(`${HEADER}\nHaus,house,das,A1\n\n,,,\nTisch,table,der,A1`);
    expect(result.words.map((w) => w.row)).toEqual([2, 5]);
    expect(result.errors).toEqual([]);
  });

  it('tolerates a trailing comma on a row', () => {
    expect(preview(`${HEADER}\nHaus,house,das,A1,`).errors).toEqual([]);
  });
});

describe('buildCsvPreview - rows with errors', () => {
  it('keeps good rows and reports bad ones by row number', () => {
    const result = preview(`${HEADER}\nHaus,house,das,A1\n,door,die,A1\nTisch,table,der,A1`);

    expect(result.words.map((w) => w.german)).toEqual(['Haus', 'Tisch']);
    expect(result.errors).toEqual([{ row: 3, problems: ['German is empty.'] }]);
  });

  it('reports every problem in a row at once', () => {
    const result = preview(`${HEADER}\n,,le,C1`);
    expect(result.errors).toEqual([
      {
        row: 2,
        problems: [
          'German is empty.',
          'English is empty.',
          'Article “le” isn’t valid. Use der, die or das, or leave it empty.',
          'Level “C1” isn’t valid. Use A1, A2 or B1.',
        ],
      },
    ]);
  });

  it('requires a level', () => {
    expect(preview(`${HEADER}\nHaus,house,das,`).errors[0].problems).toEqual([
      'Level is empty. Use A1, A2 or B1.',
    ]);
  });

  it('explains extra values as a probably-unquoted comma - and only that', () => {
    // The shifted values would otherwise also read as a bad article ("to
    // walk") and a missing level: mistakes that aren't really there.
    const result = preview(`${HEADER}\ngehen,to go, to walk,,A1`);
    expect(result.errors[0].problems).toEqual([
      'It has 5 values but the header has 4. If a value contains a comma, put the value in double quotes.',
    ]);
  });

  it('treats missing trailing values as empty', () => {
    expect(preview(`${HEADER}\nHaus,house`).errors[0].problems).toEqual([
      'Level is empty. Use A1, A2 or B1.',
    ]);
  });

  it('still returns a preview when every row has an error', () => {
    const result = preview(`${HEADER}\n,a,,A1\n,b,,A1`);
    expect(result.words).toEqual([]);
    expect(result.errors.map((e) => e.row)).toEqual([2, 3]);
  });
});

describe('buildCsvPreview - files that can’t be used', () => {
  it('rejects a file with no text', () => {
    const message =
      'This file has no text in it. The first row should be: German, English, Article, Level.';
    expect(failure('  \n\n ')).toBe(message);
    expect(failure(',,,\n,,')).toBe(message);
  });

  it('names the missing columns and shows what the header has', () => {
    expect(failure('German,Englisch,Stufe\nHaus,house,A1')).toBe(
      'Missing columns: English and Level. The first row has: “German”, “Englisch”, “Stufe”.',
    );
    expect(failure('German,English\nHaus,house')).toBe(
      'Missing column: Level. The first row has: “German”, “English”.',
    );
  });

  it('spots a missing header row (the first row is already a word)', () => {
    expect(failure('Haus,house,das,A1,home\nTisch,table,der,A1,home')).toBe(
      'Missing columns: German, English and Level. The first row should name the columns: ' +
        'German, English, Article, Level. The first row has: “Haus”, “house”, “das”, “A1”, ….',
    );
  });

  it('rejects a column that appears twice', () => {
    expect(failure('German,English,Level,german\nHaus,house,A1,x')).toBe(
      'The German column appears twice in the header row. Keep one and remove the other.',
    );
  });

  it('rejects a header with no rows below it', () => {
    expect(failure(`${HEADER}\n\n`)).toBe(
      'There are no words below the header row. Add one word per row.',
    );
  });

  it('points at an unclosed quote', () => {
    expect(failure(`${HEADER}\nHaus,house,das,A1\n"Tisch,table,der,A1`)).toBe(
      'Row 3 opens a quote (") that is never closed, so the rest of the file can’t be read. ' +
        'Add the closing quote, or remove the opening one.',
    );
  });
});

describe('planCsvImport', () => {
  const row = (row: number, german: string, english: string): CsvWordRow => ({
    row,
    german,
    english,
    level: 'A1',
  });

  it('treats rows not in the word list as new', () => {
    const words = [row(2, 'Haus', 'house'), row(3, 'Tisch', 'table')];
    expect(planCsvImport(words, [])).toEqual({ newWords: words, duplicates: new Map() });
  });

  it('skips rows already in the word list (same German and English, any case)', () => {
    const plan = planCsvImport(
      [row(2, 'haus', 'House'), row(3, 'Tisch', 'table')],
      [{ german: 'Haus', english: 'house' }],
    );
    expect(plan.newWords.map((w) => w.german)).toEqual(['Tisch']);
    expect(plan.duplicates).toEqual(new Map([[2, { of: 'existing' }]]));
  });

  it('keeps the first of repeated rows and points the others at it', () => {
    const plan = planCsvImport(
      [row(2, 'Haus', 'house'), row(3, 'Tisch', 'table'), row(4, 'HAUS', 'house')],
      [],
    );
    expect(plan.newWords.map((w) => w.row)).toEqual([2, 3]);
    expect(plan.duplicates).toEqual(new Map([[4, { of: 'row', row: 2 }]]));
  });

  it('calls a repeat of an existing word a duplicate of the word list', () => {
    const plan = planCsvImport(
      [row(2, 'Haus', 'house'), row(3, 'Haus', 'house')],
      [{ german: 'Haus', english: 'house' }],
    );
    expect(plan.newWords).toEqual([]);
    expect([...plan.duplicates.values()]).toEqual([{ of: 'existing' }, { of: 'existing' }]);
  });

  it('imports homographs with different English as separate words', () => {
    const plan = planCsvImport([row(2, 'See', 'sea')], [{ german: 'See', english: 'lake' }]);
    expect(plan.newWords).toHaveLength(1);
  });
});

describe('toWordInput', () => {
  it('gives the word the default "other" topic, keeping its article and level', () => {
    expect(
      toWordInput({ row: 2, german: 'Tür', english: 'door', gender: 'die', level: 'A2' }),
    ).toEqual({ german: 'Tür', english: 'door', gender: 'die', level: 'A2', topic: 'other' });
    expect(IMPORT_TOPIC).toBe('other');
  });

  it('leaves the article out when there is none', () => {
    expect(toWordInput({ row: 2, german: 'laufen', english: 'to run', level: 'A1' })).toEqual({
      german: 'laufen',
      english: 'to run',
      level: 'A1',
      topic: 'other',
    });
  });
});
