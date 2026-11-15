import { CSV_MAX_BYTES, checkCsvFile, formatFileSize } from './csv-file';

/** A File of exactly `size` bytes (contents don't matter - only name/size are checked). */
function file(name: string, size = 10, type = 'text/csv'): File {
  return new File([new Uint8Array(size)], name, { type });
}

describe('checkCsvFile', () => {
  it('returns null when nothing was picked', () => {
    expect(checkCsvFile(null)).toBeNull();
    expect(checkCsvFile(undefined)).toBeNull();
    expect(checkCsvFile([])).toBeNull();
  });

  it('accepts a single .csv file, passing the File through', () => {
    const f = file('words.csv');
    expect(checkCsvFile([f])).toEqual({ ok: true, file: f });
  });

  it('accepts the extension in any case', () => {
    expect(checkCsvFile([file('WORDS.CSV')])).toMatchObject({ ok: true });
    expect(checkCsvFile([file('Vokabeln.Csv')])).toMatchObject({ ok: true });
  });

  it('goes by the extension, not the browser-reported type', () => {
    // Windows with Excel installed reports CSVs as this; some systems give ''.
    expect(checkCsvFile([file('words.csv', 10, 'application/vnd.ms-excel')])).toMatchObject({
      ok: true,
    });
    expect(checkCsvFile([file('words.csv', 10, '')])).toMatchObject({ ok: true });
    // ...and a CSV-typed file with the wrong extension is still rejected.
    expect(checkCsvFile([file('words.txt', 10, 'text/csv')])).toMatchObject({
      ok: false,
      problem: 'not-csv',
    });
  });

  it('rejects other file types, passing the file through for display', () => {
    const png = file('photo.png', 10, 'image/png');
    expect(checkCsvFile([png])).toEqual({
      ok: false,
      problem: 'not-csv',
      file: png,
      message: 'This isn’t a CSV file. Choose a file ending in .csv.',
    });
    // "csv" somewhere other than the end doesn't count.
    expect(checkCsvFile([file('words.csv.xlsx')])).toMatchObject({ problem: 'not-csv' });
    expect(checkCsvFile([file('csv')])).toMatchObject({ problem: 'not-csv' });
  });

  it('rejects an empty file', () => {
    const empty = file('words.csv', 0);
    expect(checkCsvFile([empty])).toMatchObject({ ok: false, problem: 'empty', file: empty });
  });

  it('accepts a file of exactly the size limit, and rejects one byte more', () => {
    expect(checkCsvFile([file('words.csv', CSV_MAX_BYTES)])).toMatchObject({ ok: true });
    const big = file('words.csv', CSV_MAX_BYTES + 1);
    expect(checkCsvFile([big])).toMatchObject({
      ok: false,
      problem: 'too-large',
      file: big,
      message: 'This file is over the 1 MB limit. Try splitting it into smaller files.',
    });
  });

  it('rejects more than one file, without picking one to show', () => {
    expect(checkCsvFile([file('a.csv'), file('b.csv')])).toEqual({
      ok: false,
      problem: 'multiple',
      file: null,
      message: '2 files were selected. Choose just one CSV file.',
    });
  });

  it('reports the type problem before the size one', () => {
    expect(checkCsvFile([file('empty.png', 0)])).toMatchObject({ problem: 'not-csv' });
  });
});

describe('formatFileSize', () => {
  it('shows bytes below 1 KB, singular for 1', () => {
    expect(formatFileSize(0)).toBe('0 bytes');
    expect(formatFileSize(1)).toBe('1 byte');
    expect(formatFileSize(842)).toBe('842 bytes');
    expect(formatFileSize(1023)).toBe('1023 bytes');
  });

  it('shows KB and MB to one decimal, without a trailing .0', () => {
    expect(formatFileSize(1024)).toBe('1 KB');
    expect(formatFileSize(2458)).toBe('2.4 KB');
    expect(formatFileSize(12_800)).toBe('12.5 KB');
    expect(formatFileSize(1024 * 1024)).toBe('1 MB');
    expect(formatFileSize(1.5 * 1024 * 1024)).toBe('1.5 MB');
  });

  it('moves up a unit when rounding would show 1024 of the smaller one', () => {
    expect(formatFileSize(1024 * 1024 - 1)).toBe('1 MB');
  });
});
