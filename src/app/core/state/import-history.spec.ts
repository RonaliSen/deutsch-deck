import { TestBed } from '@angular/core/testing';
import { ImportHistory, ImportRecord, previousImportMessage } from './import-history';

const record = (fingerprint: string, overrides: Partial<ImportRecord> = {}): ImportRecord => ({
  fingerprint,
  fileName: `${fingerprint}.csv`,
  importedAt: new Date(2026, 10, 15, 18, 25).getTime(),
  added: 4,
  ...overrides,
});

describe('ImportHistory', () => {
  let history: ImportHistory;

  beforeEach(() => {
    localStorage.clear();
    history = TestBed.inject(ImportHistory);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it('remembers imported files by fingerprint, across instances (reloads)', () => {
    history.record(record('abc'));

    expect(history.find('abc')).toEqual(record('abc'));
    expect(new ImportHistory().find('abc')).toEqual(record('abc'));
    expect(history.find('other')).toBeUndefined();
  });

  it('keeps only the latest import of a file', () => {
    history.record(record('abc', { added: 4 }));
    history.record(record('abc', { added: 1 }));

    expect(history.find('abc')!.added).toBe(1);
    expect(JSON.parse(localStorage.getItem('deutschdeck-csv-imports')!)).toHaveLength(1);
  });

  it('keeps the 50 most recent files', () => {
    for (let i = 0; i < 55; i++) {
      history.record(record(`file${i}`));
    }
    expect(history.find('file54')).toBeDefined();
    expect(history.find('file5')).toBeDefined();
    expect(history.find('file4')).toBeUndefined();
  });

  it('shrugs off damaged storage', () => {
    localStorage.setItem('deutschdeck-csv-imports', '{not json');
    expect(history.find('abc')).toBeUndefined();

    localStorage.setItem('deutschdeck-csv-imports', JSON.stringify([{ fingerprint: 1 }, 'x']));
    expect(history.find('abc')).toBeUndefined();
    history.record(record('abc'));
    expect(history.find('abc')).toBeDefined();
  });

  it('never fails an import because storage is full or blocked', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('full', 'QuotaExceededError');
    });
    expect(() => history.record(record('abc'))).not.toThrow();
  });
});

describe('previousImportMessage', () => {
  it('says when the file was imported', () => {
    expect(previousImportMessage(record('abc'), 0)).toBe(
      'You already imported this file on 15 Nov 2026 at 18:25.',
    );
  });

  it('says how many deleted words importing again would bring back', () => {
    expect(previousImportMessage(record('abc'), 1)).toBe(
      'You already imported this file on 15 Nov 2026 at 18:25. ' +
        'Importing it again adds back 1 word that is no longer in your list.',
    );
    expect(previousImportMessage(record('abc'), 3)).toContain(
      'adds back 3 words that are no longer in your list.',
    );
  });
});
