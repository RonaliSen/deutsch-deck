import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { of } from 'rxjs';
import { Word } from '../../core/models/word.model';
import { LevelFilter, WordsStore } from '../../core/state/words.store';
import { ConfirmDialog } from '../../shared/confirm-dialog/confirm-dialog';
import { WordDialog } from './word-dialog/word-dialog';
import { Words } from './words';

function word(id: number, overrides: Partial<Word> = {}): Word {
  return {
    id,
    german: `Wort${id}`,
    english: `word${id}`,
    level: 'A1',
    topic: 'other',
    box: 1,
    dueAt: 0,
    createdAt: 0,
    ...overrides,
  };
}

function fakeStore(words: Word[]) {
  return {
    words: signal(words),
    filteredWords: signal(words),
    totalCount: signal(words.length),
    levelFilter: signal<LevelFilter>('all'),
    setSearchTerm: vi.fn(),
    setLevelFilter: vi.fn(),
    addWord: vi.fn(),
    updateWord: vi.fn(),
    deleteWord: vi.fn(),
    restoreWord: vi.fn(),
    importWords: vi.fn(),
  };
}

// The first test in this file pays the one-off cost of setting up the
// Material form-field/chip/toggle/autocomplete components - ~2s alone, but
// it can pass Vitest's 5s default when the whole suite runs in parallel on
// a slow machine. The extra allowance only matters for that cold start.
describe('Words', { timeout: 15_000 }, () => {
  let fixture: ComponentFixture<Words>;
  let el: HTMLElement;
  let store: ReturnType<typeof fakeStore>;
  let dialogResult: unknown;
  let dialog: { open: ReturnType<typeof vi.fn> };
  let snackBar: { open: ReturnType<typeof vi.fn> };

  function setup(words: Word[], { desktop = false } = {}): void {
    if (desktop) {
      vi.spyOn(window, 'matchMedia').mockImplementation(
        (query: string) =>
          ({
            matches: true,
            media: query,
            addListener: () => {},
            removeListener: () => {},
            addEventListener: () => {},
            removeEventListener: () => {},
          }) as unknown as MediaQueryList,
      );
    }
    store = fakeStore(words);
    dialog = { open: vi.fn(() => ({ afterClosed: () => of(dialogResult) })) };
    snackBar = { open: vi.fn(() => ({ onAction: () => of(undefined) })) };
    TestBed.configureTestingModule({
      providers: [
        { provide: WordsStore, useValue: store },
        { provide: MatDialog, useValue: dialog },
        { provide: MatSnackBar, useValue: snackBar },
      ],
    });
    fixture = TestBed.createComponent(Words);
    el = fixture.nativeElement;
    fixture.detectChanges();
  }

  afterEach(() => {
    vi.restoreAllMocks();
    // Import history lives in localStorage: every test starts with none.
    localStorage.clear();
  });

  const text = () => el.textContent!.replace(/\s+/g, ' ');
  const button = (label: string) =>
    el.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`) ??
    Array.from(el.querySelectorAll('button')).find((b) => b.textContent!.includes(label));

  it('lists each word with its article, plural, level and topic', () => {
    setup([
      word(1, {
        german: 'Tisch',
        english: 'table',
        gender: 'der',
        plural: 'Tische',
        topic: 'home',
      }),
    ]);
    const row = el.querySelector('.word-row')!;

    const squash = (sel: string) =>
      row.querySelector(sel)!.textContent!.replace(/\s+/g, ' ').trim();

    expect(row.classList).toContain('gender-der');
    expect(squash('.german-line')).toBe('der Tisch');
    expect(squash('.english')).toBe('table · Pl. Tische');
    expect(row.querySelector('.level')!.textContent).toContain('A1');
    expect(row.querySelector('.topic')!.textContent).toContain('home');
  });

  it('shows the count, and "x of y" while filtered', () => {
    setup([word(1), word(2), word(3)]);
    expect(el.querySelector('.count')!.textContent!.replace(/\s+/g, ' ').trim()).toBe('3 words');

    store.filteredWords.set([word(2)]);
    fixture.detectChanges();
    expect(el.querySelector('.count')!.textContent!.replace(/\s+/g, ' ').trim()).toBe(
      '1 of 3 words',
    );
  });

  it('shows "No words found" when nothing matches', () => {
    setup([]);
    expect(text()).toContain('No words found');
    expect(el.querySelector('.word-list')).toBeNull();
  });

  it('debounces search input into the store', () => {
    vi.useFakeTimers();
    try {
      setup([word(1)]);
      const input = el.querySelector<HTMLInputElement>('.search-field input')!;
      input.value = 'haus';
      input.dispatchEvent(new Event('input'));

      vi.advanceTimersByTime(100);
      expect(store.setSearchTerm).not.toHaveBeenCalled();
      vi.advanceTimersByTime(150);
      expect(store.setSearchTerm).toHaveBeenCalledWith('haus');
    } finally {
      vi.useRealTimers();
    }
  });

  it('filters by level from the chips', () => {
    setup([word(1)]);
    const b1 = Array.from(el.querySelectorAll('mat-chip-option')).find((c) =>
      c.textContent!.includes('B1'),
    );
    (b1 as HTMLElement).click();

    expect(store.setLevelFilter).toHaveBeenCalledWith('B1');
  });

  it('adds from the banner button on desktop (no FAB there)', () => {
    setup([word(1)], { desktop: true });
    dialogResult = { german: 'Fenster', english: 'window', level: 'A1', topic: 'home' };
    expect(el.querySelector('.add-fab')).toBeNull();

    button('Add word')!.click();

    expect(dialog.open).toHaveBeenCalledWith(
      WordDialog,
      expect.objectContaining({ panelClass: 'app-dialog-panel' }),
    );
    expect(store.addWord).toHaveBeenCalledWith(dialogResult);
  });

  it('adds from the FAB on mobile, and does nothing if the dialog is cancelled', () => {
    setup([word(1)]);
    dialogResult = undefined;

    el.querySelector<HTMLButtonElement>('.add-fab')!.click();

    expect(dialog.open).toHaveBeenCalledTimes(1);
    expect(store.addWord).not.toHaveBeenCalled();
  });

  it('shows Import CSV and Export CSV in the banner on mobile', () => {
    setup([word(1)]);
    const actions = el.querySelector('.banner-actions')!;

    expect(actions.textContent).toContain('Import CSV');
    expect(actions.textContent).toContain('Export CSV');
    // Add word lives on the FAB here, not in the banner.
    expect(actions.textContent).not.toContain('Add word');
  });

  it('shows Add word, Import CSV and Export CSV together on desktop', () => {
    setup([word(1)], { desktop: true });
    const labels = Array.from(el.querySelectorAll('.banner-actions button')).map((b) =>
      b.textContent!.replace(/\s+/g, ' ').trim(),
    );

    // Icons are aria-hidden ligatures, so only the visible words name the button.
    expect(labels).toEqual(['add Add word', 'upload_file Import CSV', 'download Export CSV']);
    el.querySelectorAll('.banner-actions mat-icon').forEach((icon) =>
      expect(icon.getAttribute('aria-hidden')).toBe('true'),
    );
  });

  it('opens a hidden, CSV-only file picker from Import CSV', () => {
    setup([word(1)]);
    const picker = el.querySelector<HTMLInputElement>('input[type="file"]')!;
    const click = vi.spyOn(picker, 'click').mockImplementation(() => {});

    button('Import CSV')!.click();

    expect(click).toHaveBeenCalledTimes(1);
    expect(picker.accept).toBe('.csv,text/csv');
    expect(picker.multiple).toBe(false);
    // Out of the tab order / a11y tree: the visible button is the control.
    expect(picker.hidden).toBe(true);
  });

  it('resets the file picker after a file is chosen, so the same file can be re-picked', () => {
    setup([word(1)]);
    const picker = el.querySelector<HTMLInputElement>('input[type="file"]')!;
    const setValue = vi.fn();
    const file = new File(['german,english\nHaus,house\n'], 'words.csv', { type: 'text/csv' });
    Object.defineProperty(picker, 'files', { value: [file] });
    Object.defineProperty(picker, 'value', { get: () => 'C:\\fakepath\\words.csv', set: setValue });

    picker.dispatchEvent(new Event('change'));

    expect(setValue).toHaveBeenCalledWith('');
  });

  describe('Export CSV', () => {
    /** Captures what the browser would save: jsdom has no object URLs or downloads. */
    function captureDownloads() {
      const files: { name: string; blob: Blob }[] = [];
      let blob: Blob;
      URL.createObjectURL = vi.fn((b: Blob) => ((blob = b), 'blob:test'));
      URL.revokeObjectURL = vi.fn();
      vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
        this: HTMLAnchorElement,
      ) {
        files.push({ name: this.download, blob });
      });
      return files;
    }

    it('downloads every saved word, not just the ones search or filters show', async () => {
      const all = [
        word(1, { german: 'Tisch', english: 'table', gender: 'der', level: 'A1' }),
        word(2, { german: 'gehen, laufen', english: 'to go, to walk', level: 'A2' }),
        word(3, { german: 'Tür', english: 'door', gender: 'die', level: 'B1' }),
      ];
      setup(all);
      // A search / level filter is narrowing the list to one word.
      store.filteredWords.set([all[2]]);
      fixture.detectChanges();
      const files = captureDownloads();

      button('Export CSV')!.click();

      expect(files).toHaveLength(1);
      expect(files[0].name).toMatch(/^deutschdeck-words-\d{4}-\d{2}-\d{2}\.csv$/);
      const bytes = new Uint8Array(await files[0].blob.arrayBuffer());
      expect([...bytes.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf]); // BOM, for Excel
      expect(new TextDecoder().decode(bytes)).toBe(
        'German,English,Article,Level\r\n' +
          'Tisch,table,der,A1\r\n' +
          '"gehen, laufen","to go, to walk",,A2\r\n' +
          'Tür,door,die,B1\r\n',
      );
    });

    it('confirms how many words were exported, and to which file', () => {
      setup([word(1), word(2)]);
      const files = captureDownloads();

      button('Export CSV')!.click();

      expect(snackBar.open).toHaveBeenCalledWith(
        `Exported 2 words to ${files[0].name}`,
        undefined,
        { duration: 5000 },
      );
    });

    it('exports just the header row when there are no words yet', async () => {
      setup([]);
      const files = captureDownloads();

      button('Export CSV')!.click();

      expect(await files[0].blob.text()).toBe('German,English,Article,Level\r\n');
      expect(snackBar.open).toHaveBeenCalledWith(
        `Your list is empty, so ${files[0].name} has just the header row, ready to fill in`,
        undefined,
        { duration: 5000 },
      );
    });
  });

  describe('choosing a CSV file', () => {
    const HEADER = 'German,English,Article,Level';

    /**
     * A CSV file. With `size`, the content is padded with spaces (a blank
     * row, which the parser skips) or cut to exactly that many bytes.
     */
    const csv = (name = 'words.csv', size?: number, body = `${HEADER}\nHaus,house,das,A1\n`) =>
      new File([size === undefined ? body : body.padEnd(size, ' ').slice(0, size)], name, {
        type: 'text/csv',
      });

    /** Simulates the native picker closing with `files` chosen. */
    function pick(...files: File[]): void {
      const picker = el.querySelector<HTMLInputElement>('input[type="file"]')!;
      Object.defineProperty(picker, 'files', { value: files, configurable: true });
      picker.dispatchEvent(new Event('change'));
      fixture.detectChanges();
    }

    /** Waits for the picked file to be read (reading is async). */
    async function settle(): Promise<void> {
      await vi.waitFor(() => {
        fixture.detectChanges();
        expect(el.querySelector('.reading')).toBeNull();
      });
    }

    /** A file whose read only finishes (or fails) when the test says so. */
    function slowFile(name: string, body: string) {
      let finish!: () => void;
      let fail!: () => void;
      const file = csv(name, undefined, body);
      const bytes = new TextEncoder().encode(body).buffer;
      const read = new Promise<ArrayBuffer>((resolve, reject) => {
        finish = () => resolve(bytes);
        fail = () => reject(new DOMException('gone', 'NotReadableError'));
      });
      Object.defineProperty(file, 'arrayBuffer', { value: () => read });
      return { file, finish: () => finish(), fail: () => fail() };
    }

    const panel = () => el.querySelector('app-csv-file-panel');
    const squash = (node: Element | null) => node!.textContent!.replace(/\s+/g, ' ').trim();
    const panelText = () => squash(panel());
    const fileName = () => panel()!.querySelector('.file-name')?.textContent;
    const liveText = () => el.querySelector('[aria-live]')!.textContent!.trim();
    /** Text as assistive tech gets it: aria-hidden parts (icons, the "—") left out. */
    const readable = (node: Element) => {
      const copy = node.cloneNode(true) as Element;
      copy.querySelectorAll('[aria-hidden="true"]').forEach((hidden) => hidden.remove());
      return squash(copy);
    };
    const counts = () => Array.from(el.querySelectorAll('.counts li')).map(readable);
    const tableRows = () =>
      Array.from(el.querySelectorAll('app-csv-preview tbody tr')).map((tr) =>
        Array.from(tr.querySelectorAll('td')).map(readable),
      );

    it('shows nothing until a file is chosen', () => {
      setup([word(1)]);
      expect(panel()).toBeNull();
      expect(liveText()).toBe('');
    });

    it('shows the chosen file’s name and size, and announces what it found', async () => {
      setup([word(1)]);
      pick(csv('vokabeln.csv', 2458));
      await settle();

      expect(panelText()).toContain('Selected file');
      expect(fileName()).toBe('vokabeln.csv');
      expect(panel()!.querySelector('.file-size')!.textContent).toBe('2.4 KB');
      expect(liveText()).toBe('Selected vokabeln.csv, 2.4 KB. 1 new word to import.');
    });

    it('says it is reading the file until the preview is ready', async () => {
      setup([word(1)]);
      const slow = slowFile('slow.csv', `${HEADER}\nHaus,house,das,A1`);
      pick(slow.file);

      expect(squash(el.querySelector('.reading'))).toBe('Reading the file…');
      expect(panel()!.querySelector('section')!.getAttribute('aria-busy')).toBe('true');
      expect(liveText()).toBe('');

      slow.finish();
      await settle();
      expect(tableRows()).toHaveLength(1);
      expect(panel()!.querySelector('section')!.getAttribute('aria-busy')).toBe('false');
    });

    it('previews each valid word with its German, English, article and level', async () => {
      setup([word(1)]);
      pick(
        csv(
          'words.csv',
          undefined,
          `${HEADER}\n"gehen, laufen","to go, to walk",,A2\nTür,door,die,B1\n`,
        ),
      );
      await settle();

      const headers = Array.from(el.querySelectorAll('app-csv-preview th')).map((th) => squash(th));
      expect(headers).toEqual(['German', 'English', 'Article', 'Level']);
      el.querySelectorAll('app-csv-preview th').forEach((th) =>
        expect(th.getAttribute('scope')).toBe('col'),
      );
      // Commas inside quotes stay in the value; no article shows "—", read as "none".
      expect(tableRows()).toEqual([
        ['gehen, laufen', 'to go, to walk', 'none', 'A2'],
        ['Tür', 'door', 'die', 'B1'],
      ]);
      expect(el.querySelector('app-csv-preview .none')!.textContent).toBe('—');
      expect(el.querySelector('app-csv-preview app-article-badge')).not.toBeNull();
      expect(el.querySelector('app-csv-preview .level--B1')).not.toBeNull();
      expect(el.querySelector('app-csv-preview .german')!.getAttribute('lang')).toBe('de');
    });

    it('counts valid words and rows with errors, listing each error by row', async () => {
      setup([word(1)]);
      pick(
        csv(
          'words.csv',
          undefined,
          `${HEADER}\nHaus,house,das,A1\n,door,die,A1\nTisch,table,der,C1\n`,
        ),
      );
      await settle();

      expect(counts()).toEqual(['1 new word to import', '2 rows with errors']);
      const errors = Array.from(el.querySelectorAll('.error-list li')).map((li) => squash(li));
      expect(errors).toEqual([
        'Row 3 German is empty.',
        'Row 4 Level “C1” isn’t valid. Use A1, A2 or B1.',
      ]);
      expect(tableRows()).toEqual([['Haus', 'house', 'das', 'A1']]);
      const size = panel()!.querySelector('.file-size')!.textContent;
      expect(liveText()).toBe(
        `Selected words.csv, ${size}. 1 new word to import, 2 rows with errors.`,
      );
    });

    it('says nothing can be imported when every row has an error', async () => {
      setup([word(1)]);
      pick(csv('words.csv', undefined, `${HEADER}\n,door,die,A1\n`));
      await settle();

      expect(el.querySelector('app-csv-preview table')).toBeNull();
      expect(counts()).toEqual(['0 new words to import', '1 row with errors']);
      expect(panelText()).toContain('None of the rows can be imported yet.');
    });

    it('notes columns it ignores', async () => {
      setup([word(1)]);
      pick(csv('words.csv', undefined, 'German,English,Level,Topic\nHaus,house,A1,home\n'));
      await settle();

      expect(readable(el.querySelector('app-csv-preview .note')!)).toBe(
        'Ignored column: Topic. Only German, English, Article and Level are read for now.',
      );
    });

    it('shows header problems as a file that can’t be used', async () => {
      setup([word(1)]);
      pick(csv('words.csv', undefined, 'German,English\nHaus,house\n'));
      await settle();

      expect(panel()!.querySelector('.panel--error')).not.toBeNull();
      expect(panelText()).toContain('Can’t use this file');
      expect(panelText()).toContain('Missing column: Level.');
      expect(el.querySelector('app-csv-preview')).toBeNull();
      expect(liveText()).toBe(
        'Can’t use words.csv. Missing column: Level. The first row has: “German”, “English”.',
      );
    });

    it('caps the table and the error list, saying how many more there are', async () => {
      setup([word(1, { german: 'Tisch', english: 'table' })]); // not one of the WortN rows
      const good = Array.from({ length: 120 }, (_, i) => `Wort${i},word${i},,A1`);
      const bad = Array.from({ length: 55 }, (_, i) => `Fehler${i},,,A1`);
      pick(csv('big.csv', undefined, [HEADER, ...good, ...bad].join('\n')));
      await settle();

      expect(counts()).toEqual(['120 new words to import', '55 rows with errors']);
      expect(tableRows()).toHaveLength(100);
      expect(panelText()).toContain('Showing the first 100 of 120 words.');
      expect(el.querySelectorAll('.error-list li')).toHaveLength(50);
      expect(panelText()).toContain('…and 5 more rows with errors.');
    });

    it('explains why a file can’t be used, still naming it', () => {
      setup([word(1)]);
      pick(new File(['x'], 'notes.txt', { type: 'text/plain' }));

      expect(panel()!.querySelector('.panel--error')).not.toBeNull();
      expect(panelText()).toContain('Can’t use this file');
      expect(fileName()).toBe('notes.txt');
      expect(panelText()).toContain('This isn’t a CSV file. Choose a file ending in .csv.');
      expect(liveText()).toBe(
        'Can’t use notes.txt. This isn’t a CSV file. Choose a file ending in .csv.',
      );
    });

    it('rejects empty and oversized CSVs', () => {
      setup([word(1)]);
      pick(csv('empty.csv', 0));
      expect(panelText()).toContain('This file is empty.');

      pick(csv('big.csv', 2 * 1024 * 1024));
      expect(panelText()).toContain('This file is over the 1 MB limit.');
      expect(panel()!.querySelector('.file-size')!.textContent).toBe('2 MB');
    });

    it('rejects several files at once, without naming one', () => {
      setup([word(1)]);
      pick(csv('a.csv'), csv('b.csv'));

      expect(panel()!.querySelector('.file-name')).toBeNull();
      expect(panelText()).toContain('2 files were selected. Choose just one CSV file.');
      expect(liveText()).toBe(
        'Can’t use this selection. 2 files were selected. Choose just one CSV file.',
      );
    });

    it('replaces the shown file when another is chosen, good or bad', async () => {
      setup([word(1)]);
      pick(csv('first.csv'));
      await settle();
      pick(new File(['x'], 'photo.png', { type: 'image/png' }));
      expect(fileName()).toBe('photo.png');
      expect(el.querySelector('app-csv-preview')).toBeNull();

      pick(csv('second.csv'));
      await settle();
      expect(panel()!.querySelector('.panel--error')).toBeNull();
      expect(fileName()).toBe('second.csv');
      expect(tableRows()).toHaveLength(1);
    });

    it('ignores a slow read that finishes after another file was chosen', async () => {
      setup([word(1)]);
      const slow = slowFile('slow.csv', `${HEADER}\nAlt,old,,A1`);
      pick(slow.file);
      pick(csv('fast.csv', undefined, `${HEADER}\nNeu,new,,A1\n`));
      await settle();

      slow.finish();
      await new Promise((resolve) => setTimeout(resolve));
      fixture.detectChanges();

      expect(fileName()).toBe('fast.csv');
      expect(tableRows()).toEqual([['Neu', 'new', 'none', 'A1']]);
    });

    it('stays closed if Cancel is pressed while the file is being read', async () => {
      setup([word(1)]);
      const slow = slowFile('slow.csv', `${HEADER}\nAlt,old,,A1`);
      pick(slow.file);
      button('Cancel')!.click();
      fixture.detectChanges();

      slow.finish();
      await new Promise((resolve) => setTimeout(resolve));
      fixture.detectChanges();

      expect(panel()).toBeNull();
    });

    it('says so if the file can’t be read', async () => {
      setup([word(1)]);
      const slow = slowFile('gone.csv', HEADER);
      pick(slow.file);
      slow.fail();
      await settle();

      expect(panelText()).toContain('This file couldn’t be read.');
      expect(panel()!.querySelector('.panel--error')).not.toBeNull();
    });

    it('keeps the shown file if the picker is closed without choosing', async () => {
      setup([word(1)]);
      pick(csv('keep-me.csv'));
      await settle();
      pick();

      expect(fileName()).toBe('keep-me.csv');
      expect(tableRows()).toHaveLength(1);
    });

    it('"Choose another file" reopens the picker', async () => {
      setup([word(1)]);
      pick(csv());
      await settle();
      const click = vi
        .spyOn(el.querySelector<HTMLInputElement>('input[type="file"]')!, 'click')
        .mockImplementation(() => {});

      button('Choose another file')!.click();

      expect(click).toHaveBeenCalledTimes(1);
    });

    describe('importing', () => {
      const FILE = [
        HEADER,
        'Tür,door,die,A2', // new
        'haus,House,das,A1', // already in the list (as "Haus, house")
        'laufen,to run,,A1', // new
        'Tür,door,die,A2', // repeats row 2
        ',broken,,A1', // error
      ].join('\n');
      const existing = () => word(1, { german: 'Haus', english: 'house' });
      const importButton = () => el.querySelector<HTMLButtonElement>('button.import');
      const result = () => el.querySelector<HTMLElement>('.result');

      async function preview(words = [existing()]): Promise<void> {
        setup(words);
        pick(csv('words.csv', undefined, FILE));
        await settle();
      }

      /** Lets the (faked) save resolve and the page re-render. */
      async function flush(): Promise<void> {
        await new Promise((resolve) => setTimeout(resolve));
        fixture.detectChanges();
      }

      it('counts only new words, marking each duplicate with why it is skipped', async () => {
        await preview();

        expect(counts()).toEqual([
          '2 new words to import',
          '2 duplicates to skip',
          '1 row with errors',
        ]);
        expect(tableRows().map((row) => row[0])).toEqual([
          'Tür',
          'haus Already in your list',
          'laufen',
          'Tür Repeats row 2',
        ]);
        expect(squash(importButton())).toBe('library_add Import 2 words');
        expect(liveText()).toContain(
          '2 new words to import, 2 duplicates to skip, 1 row with errors.',
        );
      });

      it('keeps the count in step with the word list', async () => {
        await preview();
        store.words.set([existing(), word(2, { german: 'Laufen', english: 'to run' })]);
        fixture.detectChanges();

        expect(squash(importButton())).toBe('library_add Import 1 word');
      });

      it('saves every valid row with the "other" topic, and shows the result', async () => {
        await preview();
        store.importWords.mockResolvedValue({ added: [{}, {}], duplicates: 2 });

        importButton()!.click();
        await flush();

        // All valid rows: the store makes the final duplicate check against what's saved.
        expect(store.importWords).toHaveBeenCalledWith([
          { german: 'Tür', english: 'door', gender: 'die', level: 'A2', topic: 'other' },
          { german: 'haus', english: 'House', gender: 'das', level: 'A1', topic: 'other' },
          { german: 'laufen', english: 'to run', level: 'A1', topic: 'other' },
          { german: 'Tür', english: 'door', gender: 'die', level: 'A2', topic: 'other' },
        ]);
        expect(panelText()).toContain('Import complete');
        expect(squash(result())).toBe(
          'Added 2 words to your list. Skipped 2 duplicates and 1 row with errors.',
        );
        expect(el.querySelector('app-csv-preview')).toBeNull();
        expect(importButton()).toBeNull();
      });

      it('moves focus to the result, and relabels the buttons', async () => {
        await preview();
        store.importWords.mockResolvedValue({ added: [{}, {}], duplicates: 2 });
        importButton()!.focus();

        importButton()!.click();
        await flush();

        expect(document.activeElement).toBe(result());
        expect(button('Import another file')).toBeTruthy();
        expect(button('Done')).toBeTruthy();
        expect(liveText()).toBe(''); // the focused result is read out instead
      });

      it('Done closes the result and returns focus to Import CSV', async () => {
        await preview();
        store.importWords.mockResolvedValue({ added: [{}], duplicates: 0 });
        importButton()!.click();
        await flush();

        button('Done')!.click();
        fixture.detectChanges();

        expect(panel()).toBeNull();
        expect(document.activeElement).toBe(el.querySelector('.import-csv'));
      });

      it('says when nothing was added after all', async () => {
        await preview();
        // Everything turned duplicate between preview and click (e.g. another tab).
        store.importWords.mockResolvedValue({ added: [], duplicates: 4 });

        importButton()!.click();
        await flush();

        expect(squash(result())).toBe(
          'No words were added — they’re all in your list already. ' +
            'Skipped 4 duplicates and 1 row with errors.',
        );
      });

      it('offers no button when every word is already in the list', async () => {
        await preview([
          existing(),
          word(2, { german: 'Tür', english: 'door' }),
          word(3, { german: 'laufen', english: 'to run' }),
        ]);

        expect(importButton()).toBeNull();
        expect(panelText()).toContain(
          'Every word in this file is already in your list, so there’s nothing new to import.',
        );
      });

      it('imports once, however often it is clicked while saving', async () => {
        await preview();
        let finish!: (value: unknown) => void;
        store.importWords.mockReturnValue(new Promise((resolve) => (finish = resolve)));

        importButton()!.click();
        fixture.detectChanges();
        expect(squash(importButton())).toBe('Importing…');
        expect(importButton()!.getAttribute('aria-disabled')).toBe('true');
        // Cancel / Choose another can't discard the card mid-save.
        expect(button('Cancel')!.disabled).toBe(true);
        expect(button('Choose another file')!.disabled).toBe(true);
        importButton()!.click();
        // The save lands in the list before the result shows: the button
        // must not flip to "nothing new to import" in between.
        store.words.set([
          existing(),
          word(2, { german: 'Tür', english: 'door' }),
          word(3, { german: 'laufen', english: 'to run' }),
        ]);
        fixture.detectChanges();
        expect(squash(importButton())).toBe('Importing…');

        finish({ added: [{}, {}], duplicates: 2 });
        await flush();
        expect(store.importWords).toHaveBeenCalledTimes(1);
        expect(panelText()).toContain('Import complete');
      });

      it('keeps the preview and says nothing was imported if saving fails', async () => {
        await preview();
        store.importWords.mockRejectedValue(new Error('QuotaExceededError'));

        importButton()!.click();
        await flush();

        const alert = el.querySelector('[role="alert"]')!;
        expect(readable(alert)).toBe(
          'The words couldn’t be saved, so nothing was imported. Please try again.',
        );
        expect(squash(importButton())).toBe('library_add Import 2 words');
        expect(tableRows()).toHaveLength(4);
      });
    });

    it('Cancel discards the preview and returns focus to Import CSV', async () => {
      setup([word(1)]);
      pick(csv());
      await settle();
      const cancel = Array.from(panel()!.querySelectorAll('button')).find(
        (b) => b.textContent!.trim() === 'Cancel',
      )!;

      cancel.focus();
      cancel.click();
      fixture.detectChanges();

      expect(panel()).toBeNull();
      expect(liveText()).toBe('');
      expect(document.activeElement).toBe(el.querySelector('.import-csv'));
      // Preview only - nothing was saved.
      expect(store.addWord).not.toHaveBeenCalled();
    });
  });

  it('edits a word through the dialog, passing the word in', () => {
    const w = word(7, { german: 'Tisch' });
    setup([w]);
    dialogResult = { german: 'Tisch', english: 'desk', level: 'A2', topic: 'home' };

    button('Edit Tisch')!.click();

    expect(dialog.open).toHaveBeenCalledWith(
      WordDialog,
      expect.objectContaining({ data: { word: w } }),
    );
    expect(store.updateWord).toHaveBeenCalledWith(7, dialogResult);
  });

  it('deletes after confirming, with Undo restoring the word', () => {
    const w = word(3, { german: 'Tisch', english: 'table' });
    setup([w]);
    dialogResult = true;

    button('Delete Tisch')!.click();

    expect(dialog.open).toHaveBeenCalledWith(
      ConfirmDialog,
      expect.objectContaining({
        data: expect.objectContaining({
          title: 'Delete word?',
          message: '"Tisch" (table) will be removed.',
        }),
      }),
    );
    expect(store.deleteWord).toHaveBeenCalledWith(3);
    expect(snackBar.open).toHaveBeenCalledWith('Word deleted', 'Undo', { duration: 5000 });
    // The fake snack bar's onAction() emits immediately, i.e. "Undo" clicked.
    expect(store.restoreWord).toHaveBeenCalledWith(w);
  });

  it('keeps the word when the delete is not confirmed', () => {
    setup([word(3, { german: 'Tisch' })]);
    dialogResult = false;

    button('Delete Tisch')!.click();

    expect(store.deleteWord).not.toHaveBeenCalled();
    expect(snackBar.open).not.toHaveBeenCalled();
  });
});
