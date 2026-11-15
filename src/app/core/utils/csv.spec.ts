import { decodeCsvBytes, detectDelimiter, formatCsv, formatCsvField, parseCsv } from './csv';

/** Just the fields, for compact expectations. */
function fields(text: string, delimiter: ',' | ';' = ','): string[][] {
  const result = parseCsv(text, delimiter);
  if (!result.ok) {
    throw new Error(`unexpected parse failure at row ${result.row}`);
  }
  return result.records.map((r) => r.fields);
}

describe('parseCsv', () => {
  it('splits plain rows and fields', () => {
    expect(fields('German,English\nHaus,house\nTisch,table')).toEqual([
      ['German', 'English'],
      ['Haus', 'house'],
      ['Tisch', 'table'],
    ]);
  });

  it('keeps commas inside quoted values', () => {
    expect(fields('"gehen, laufen","to go, to walk",A1')).toEqual([
      ['gehen, laufen', 'to go, to walk', 'A1'],
    ]);
  });

  it('turns doubled quotes inside quotes into one literal quote', () => {
    expect(fields('"sagen","to say ""hello""",A1')).toEqual([['sagen', 'to say "hello"', 'A1']]);
    expect(fields('"",x')).toEqual([['', 'x']]);
  });

  it('keeps line breaks inside quoted values', () => {
    expect(fields('"line one\nline two",x\nnext,row')).toEqual([
      ['line one\nline two', 'x'],
      ['next', 'row'],
    ]);
  });

  it('handles CRLF, LF and CR line endings alike', () => {
    const expected = [
      ['a', 'b'],
      ['c', 'd'],
    ];
    expect(fields('a,b\r\nc,d\r\n')).toEqual(expected);
    expect(fields('a,b\nc,d\n')).toEqual(expected);
    expect(fields('a,b\rc,d')).toEqual(expected);
  });

  it('keeps empty fields, including trailing ones', () => {
    expect(fields('Haus,,A1,')).toEqual([['Haus', '', 'A1', '']]);
  });

  it('adds no extra row for a final line break, but keeps blank lines in the numbering', () => {
    const result = parseCsv('header\n\nHaus\n');
    expect(result).toEqual({
      ok: true,
      records: [
        { row: 1, fields: ['header'] },
        { row: 2, fields: [''] },
        { row: 3, fields: ['Haus'] },
      ],
    });
  });

  it('numbers rows as a spreadsheet does, even past a multi-line value', () => {
    const result = parseCsv('h\n"two\nlines"\nthird');
    expect(result.ok && result.records.map((r) => r.row)).toEqual([1, 2, 3]);
  });

  it('is lenient about stray quotes, like spreadsheets', () => {
    expect(fields('Ha"us,x')).toEqual([['Ha"us', 'x']]);
    expect(fields('"Haus"x,y')).toEqual([['Hausx', 'y']]);
  });

  it('reports the row of a quote that is never closed', () => {
    expect(parseCsv('German,English\nHaus,house\n"Tisch,table\nStuhl,chair')).toEqual({
      ok: false,
      row: 3,
    });
  });

  it('splits on semicolons when told to, leaving commas alone', () => {
    expect(fields('Haus;house, home;A1', ';')).toEqual([['Haus', 'house, home', 'A1']]);
  });

  it('returns no records for empty text', () => {
    expect(fields('')).toEqual([]);
  });
});

describe('detectDelimiter', () => {
  it('defaults to commas', () => {
    expect(detectDelimiter('German,English,Level\nHaus,house,A1')).toBe(',');
    expect(detectDelimiter('German')).toBe(',');
  });

  it('picks semicolons when the header has more of them (e.g. German Excel)', () => {
    expect(detectDelimiter('German;English;Level\n"Haus";"house, home";A1')).toBe(';');
  });

  it('only looks at the header line, skipping leading blank lines', () => {
    expect(detectDelimiter('\n\nGerman,English\na;b;c;d')).toBe(',');
  });
});

describe('decodeCsvBytes', () => {
  it('reads UTF-8, including umlauts and ß', () => {
    const bytes = new TextEncoder().encode('Bär,Straße');
    expect(decodeCsvBytes(bytes)).toBe('Bär,Straße');
  });

  it('drops a UTF-8 byte-order mark (Excel adds one)', () => {
    const bytes = new Uint8Array([0xef, 0xbb, 0xbf, ...new TextEncoder().encode('German')]);
    expect(decodeCsvBytes(bytes)).toBe('German');
  });

  it('falls back to Windows-1252 when the bytes aren’t valid UTF-8', () => {
    // "Bär,Straße" as Excel on Windows saves it: ä = 0xE4, ß = 0xDF.
    const bytes = new Uint8Array([0x42, 0xe4, 0x72, 0x2c, 0x53, 0x74, 0x72, 0x61, 0xdf, 0x65]);
    expect(decodeCsvBytes(bytes)).toBe('Bär,Straße');
  });
});

describe('formatCsvField', () => {
  it('leaves plain values alone', () => {
    expect(formatCsvField('Straße')).toBe('Straße');
    expect(formatCsvField('')).toBe('');
  });

  it('quotes values with the delimiter, a quote or a line break, doubling quotes', () => {
    expect(formatCsvField('to go, to walk')).toBe('"to go, to walk"');
    expect(formatCsvField('to say "hi"')).toBe('"to say ""hi"""');
    expect(formatCsvField('one\ntwo')).toBe('"one\ntwo"');
    expect(formatCsvField('one\rtwo')).toBe('"one\rtwo"');
  });

  it('quotes for the delimiter in use', () => {
    expect(formatCsvField('a;b', ';')).toBe('"a;b"');
    expect(formatCsvField('a,b', ';')).toBe('a,b');
  });
});

describe('formatCsv', () => {
  it('joins fields and ends every row with CRLF', () => {
    expect(
      formatCsv([
        ['German', 'English'],
        ['Haus', 'house'],
      ]),
    ).toBe('German,English\r\nHaus,house\r\n');
  });

  it('is read back exactly by parseCsv', () => {
    const rows = [
      ['German', 'English', 'Article', 'Level'],
      ['gehen, laufen', 'to go, to walk', '', 'A1'],
      ['sagen', 'to say "hi"', '', 'A2'],
      ['Zeile', 'line one\nline two', 'die', 'B1'],
      ['Bär', '"quoted"', 'der', 'A1'],
    ];
    expect(fields(formatCsv(rows))).toEqual(rows);
  });
});
