import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { DeutschDeckDb } from '../../core/data/db';
import { Word } from '../../core/models/word.model';
import { WordsStore } from '../../core/state/words.store';
import { Words } from './words';

// End to end through the real Words page, the real WordsStore and real
// Dexie (on fake-indexeddb, see test-setup.ts), seeded with the starter
// words like a first visit. Only the add/edit dialog and the snack bar are
// stand-ins - they aren't what's under test. Every check on "nothing
// changed" compares a full snapshot of the saved words: every field,
// review progress included.
describe('CSV import, end to end', { timeout: 15_000 }, () => {
  const HEADER = 'German,English,Article,Level';

  let fixture: ComponentFixture<Words>;
  let el: HTMLElement;
  let db: DeutschDeckDb;
  let store: InstanceType<typeof WordsStore>;

  beforeEach(async () => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        { provide: MatDialog, useValue: { open: vi.fn() } },
        { provide: MatSnackBar, useValue: { open: vi.fn() } },
      ],
    });
    db = TestBed.inject(DeutschDeckDb);
    await db.delete();
    await db.open();
    fixture = TestBed.createComponent(Words);
    el = fixture.nativeElement;
    store = TestBed.inject(WordsStore);
    await vi.waitFor(() => expect(store.loading()).toBe(false));
    fixture.detectChanges();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
    db.close();
  });

  // --- helpers ---

  /** Every saved word, every field, in id order. */
  const snapshot = () => db.words.orderBy('id').toArray();
  const squash = (node: Element | null) => node?.textContent!.replace(/\s+/g, ' ').trim() ?? '';
  const countText = () => squash(el.querySelector('p.count'));
  /** Text as assistive tech gets it: aria-hidden parts (icon ligatures) left out. */
  const readable = (node: Element | null) => {
    const copy = node!.cloneNode(true) as Element;
    copy.querySelectorAll('[aria-hidden="true"]').forEach((hidden) => hidden.remove());
    return squash(copy);
  };
  const counts = () => Array.from(el.querySelectorAll('.counts li')).map(readable);
  const importButton = () => el.querySelector<HTMLButtonElement>('button.import');
  /** A button by its accessible name. */
  const button = (label: string) =>
    Array.from(el.querySelectorAll('button')).find((b) => readable(b) === label)!;
  const panelText = () => squash(el.querySelector('app-csv-file-panel'));

  const csvFile = (text: string, name = 'words.csv') =>
    new File([text], name, { type: 'text/csv' });

  /** Simulates the picker closing with `file` chosen, then waits for the preview. */
  async function pick(file: File): Promise<void> {
    const picker = el.querySelector<HTMLInputElement>('input[type="file"]')!;
    Object.defineProperty(picker, 'files', { value: [file], configurable: true });
    picker.dispatchEvent(new Event('change'));
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(el.querySelector('.reading')).toBeNull();
    });
  }

  /** Clicks Import and waits until the words are saved and the result shows. */
  async function importAndWait(): Promise<void> {
    importButton()!.click();
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(el.querySelector('.result')).not.toBeNull();
    });
  }

  /** What Export CSV downloads, as a File ready to pick. */
  async function exportCsv(): Promise<File> {
    let blob!: Blob;
    URL.createObjectURL = vi.fn((b: Blob) => ((blob = b), 'blob:test'));
    URL.revokeObjectURL = vi.fn();
    let name = '';
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      name = this.download;
    });
    button('Export CSV').click();
    return new File([await blob.arrayBuffer()], name, { type: 'text/csv' });
  }

  // --- exported files ---

  describe('importing an exported file', () => {
    it('finds every word already saved - nothing new, nothing written', async () => {
      const before = await snapshot();
      expect(before).toHaveLength(86); // the starter words

      await pick(await exportCsv());

      expect(counts()).toEqual(['0 new words to import', '86 duplicates to skip']);
      expect(importButton()).toBeNull();
      expect(panelText()).toContain('Every word in this file is already in your list');
      expect(await snapshot()).toEqual(before);
      expect(countText()).toBe('86 words');
    });

    it('round-trips awkward words (commas, quotes, umlauts) without duplicating them', async () => {
      await pick(
        csvFile(
          [
            HEADER,
            '"gehen, laufen","to go, to walk",,A1',
            'sagen,"to say ""hello""",,A2',
            'Mädchen,"girl, young woman",das,A1',
          ].join('\n'),
        ),
      );
      await importAndWait();
      button('Done').click();
      fixture.detectChanges();
      const before = await snapshot();

      await pick(await exportCsv());

      expect(counts()).toEqual(['0 new words to import', '89 duplicates to skip']);
      expect(await snapshot()).toEqual(before);
    });

    it('re-imports only the words deleted since the export', async () => {
      const exported = await exportCsv();
      const tisch = store.words().find((w) => w.german === 'Tisch')!;
      await store.deleteWord(tisch.id!);
      fixture.detectChanges();
      expect(countText()).toBe('85 words');

      await pick(exported);
      expect(counts()).toEqual(['1 new word to import', '85 duplicates to skip']);
      await importAndWait();

      const saved = await snapshot();
      expect(saved).toHaveLength(86);
      expect(saved.filter((w) => w.german === 'Tisch' && w.english === 'table')).toHaveLength(1);
    });
  });

  // --- mixed files ---

  describe('a file mixing new, duplicate and invalid rows', () => {
    const MIXED = [
      HEADER,
      'Regenschirm,umbrella,der,A2', //         2: new
      'tisch,TABLE,der,B1', //                  3: already saved ("Tisch, table") - other details
      'laufen,to run,,A1', //                   4: new
      ',chair,der,A1', //                       5: invalid - German empty
      'Regenschirm,umbrella,der,A2', //         6: repeats row 2
      'See,sea,die,B1', //                      7: new - not the same word as "See, lake"
      'Krankenhaus,hospital,das,C1', //         8: invalid - level
      'gehen,to go, to walk,,A1', //            9: invalid - unquoted comma
      '', //                                    blank - ignored
      '"Guten Tag","good day, hello",,A1', //  11: new
    ].join('\r\n');

    it('previews each kind of row accurately', async () => {
      await pick(csvFile(MIXED));

      expect(counts()).toEqual([
        '4 new words to import',
        '2 duplicates to skip',
        '3 rows with errors',
      ]);
      const errors = Array.from(el.querySelectorAll('.error-list li')).map(squash);
      expect(errors).toEqual([
        'Row 5 German is empty.',
        'Row 8 Level “C1” isn’t valid. Use A1, A2 or B1.',
        'Row 9 It has 5 values but the header has 4. If a value contains a comma, put the value in double quotes.',
      ]);
      const duplicates = Array.from(el.querySelectorAll('.duplicate')).map(squash);
      expect(duplicates).toEqual(['Already in your list', 'Repeats row 2']);
      expect(readable(importButton())).toBe('Import 4 words');
    });

    it('saves exactly the new words, leaving existing ones untouched', async () => {
      const tisch = store.words().find((w) => w.german === 'Tisch')!;
      await db.words.update(tisch.id!, { box: 4, dueAt: 12345 }); // review progress
      await store.load();
      const before = await snapshot();

      await pick(csvFile(MIXED));
      await importAndWait();

      const after = await snapshot();
      // Every word that was there is still there, unchanged.
      expect(after.slice(0, before.length)).toEqual(before);
      // Plus exactly the four new ones, as new words: topic "other", box 1.
      const added = after.slice(before.length);
      expect(
        added.map(({ german, english, gender, level, topic, box }) => ({
          german,
          english,
          gender,
          level,
          topic,
          box,
        })),
      ).toEqual([
        {
          german: 'Regenschirm',
          english: 'umbrella',
          gender: 'der',
          level: 'A2',
          topic: 'other',
          box: 1,
        },
        {
          german: 'laufen',
          english: 'to run',
          gender: undefined,
          level: 'A1',
          topic: 'other',
          box: 1,
        },
        { german: 'See', english: 'sea', gender: 'die', level: 'B1', topic: 'other', box: 1 },
        {
          german: 'Guten Tag',
          english: 'good day, hello',
          gender: undefined,
          level: 'A1',
          topic: 'other',
          box: 1,
        },
      ]);
      expect(squash(el.querySelector('.result'))).toBe(
        'Added 4 words to your list. Skipped 2 duplicates and 3 rows with errors.',
      );
      // The list and count refresh at once.
      expect(countText()).toBe('90 words');
      expect(squash(el.querySelector('app-word-list'))).toContain('Regenschirm');
    });
  });

  // --- the same file twice ---

  describe('importing the same file twice', () => {
    const FILE = [HEADER, 'Regenschirm,umbrella,der,A2', 'laufen,to run,,A1'].join('\n');

    it('imports once, however often Import is clicked', async () => {
      await pick(csvFile(FILE));
      importButton()!.click();
      importButton()!.click();
      importButton()!.click();
      await vi.waitFor(() => {
        fixture.detectChanges();
        expect(el.querySelector('.result')).not.toBeNull();
      });

      expect(await db.words.count()).toBe(88);
      expect(await db.words.filter((w) => w.german === 'Regenschirm').count()).toBe(1);
    });

    it('recognises the file when it is picked again, and adds nothing', async () => {
      await pick(csvFile(FILE, 'vokabeln.csv'));
      await importAndWait();
      const before = await snapshot();

      button('Import another file').click(); // picker opens...
      await pick(csvFile(FILE, 'vokabeln.csv')); // ...and the same file is chosen

      expect(panelText()).toMatch(/You already imported this file on .+ at \d\d:\d\d\./);
      // ...and screen readers hear it too.
      expect(squash(el.querySelector('[aria-live]'))).toMatch(
        /0 new words to import, 2 duplicates to skip\. You already imported this file on /,
      );
      expect(importButton()).toBeNull();
      expect(await snapshot()).toEqual(before);
    });

    it('recognises it even renamed, re-saved with other line endings, or after a reload', async () => {
      await pick(csvFile(FILE));
      await importAndWait();
      // A fresh page (as after a reload): history comes from localStorage.
      fixture.destroy();
      fixture = TestBed.createComponent(Words);
      el = fixture.nativeElement;
      fixture.detectChanges();

      await pick(csvFile(FILE.replace(/\n/g, '\r\n') + '\r\n', 'vokabeln (1).csv'));

      expect(panelText()).toContain('You already imported this file on');
    });

    it('warns before bringing back words deleted since, and says how many', async () => {
      await pick(csvFile(FILE));
      await importAndWait();
      const laufen = store.words().find((w) => w.german === 'laufen')!;
      await store.deleteWord(laufen.id!); // deliberately removed afterwards

      await pick(csvFile(FILE));

      expect(panelText()).toContain(
        'Importing it again adds back 1 word that is no longer in your list.',
      );
      expect(readable(importButton())).toBe('Import 1 word again');
      expect(await db.words.filter((w) => w.german === 'laufen').count()).toBe(0);
    });

    it('does not flag a different file with some of the same words', async () => {
      await pick(csvFile(FILE));
      await importAndWait();

      await pick(csvFile(FILE + '\nSofa,sofa,das,A1'));

      expect(panelText()).not.toContain('You already imported this file');
      expect(readable(importButton())).toBe('Import 1 word');
    });
  });

  // --- cancelling ---

  describe('cancelling', () => {
    const FILE = [HEADER, 'Regenschirm,umbrella,der,A2', ',broken,,A1'].join('\n');
    let before: Word[];

    beforeEach(async () => {
      before = await snapshot();
    });

    async function cancelAndCheckNothingSaved(): Promise<void> {
      button('Cancel').click();
      fixture.detectChanges();
      // Give any stray write a chance to land before checking.
      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(el.querySelector('app-csv-file-panel')).toBeNull();
      expect(await snapshot()).toEqual(before);
      expect(store.totalCount()).toBe(before.length);
      expect(countText()).toBe(`${before.length} words`);
      expect(localStorage.getItem('deutschdeck-csv-imports')).toBeNull(); // not "imported"
    }

    it('from the preview saves nothing', async () => {
      await pick(csvFile(FILE));
      expect(importButton()).not.toBeNull();
      await cancelAndCheckNothingSaved();
    });

    it('from a file that can’t be used saves nothing', async () => {
      await pick(csvFile('German,English\nHaus,house'));
      expect(panelText()).toContain('Missing column: Level.');
      await cancelAndCheckNothingSaved();
    });

    it('while the file is still being read saves nothing, even once the read finishes', async () => {
      const file = csvFile(FILE);
      let finish!: () => void;
      const read = new Promise<ArrayBuffer>((resolve) => {
        finish = () => resolve(new TextEncoder().encode(FILE).buffer);
      });
      Object.defineProperty(file, 'arrayBuffer', { value: () => read });
      const picker = el.querySelector<HTMLInputElement>('input[type="file"]')!;
      Object.defineProperty(picker, 'files', { value: [file], configurable: true });
      picker.dispatchEvent(new Event('change'));
      fixture.detectChanges();

      button('Cancel').click();
      fixture.detectChanges();
      finish();
      await new Promise((resolve) => setTimeout(resolve, 50));
      fixture.detectChanges();

      expect(el.querySelector('app-csv-file-panel')).toBeNull();
      expect(await snapshot()).toEqual(before);
    });

    it('after a failed save saves nothing - the write was all or nothing', async () => {
      vi.spyOn(db.words, 'bulkAdd').mockRejectedValueOnce(new Error('QuotaExceededError'));
      await pick(csvFile(FILE));
      importButton()!.click();
      await vi.waitFor(() => {
        fixture.detectChanges();
        expect(el.querySelector('[role="alert"]')).not.toBeNull();
      });

      expect(await snapshot()).toEqual(before);
      await cancelAndCheckNothingSaved();
    });

    it('is not possible mid-save, so a save can’t be left half-done', async () => {
      await pick(csvFile(FILE));
      importButton()!.click();
      fixture.detectChanges();

      expect(button('Cancel').disabled).toBe(true);
      expect(button('Choose another file').disabled).toBe(true);
    });
  });
});
