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
    filteredWords: signal(words),
    totalCount: signal(words.length),
    levelFilter: signal<LevelFilter>('all'),
    setSearchTerm: vi.fn(),
    setLevelFilter: vi.fn(),
    addWord: vi.fn(),
    updateWord: vi.fn(),
    deleteWord: vi.fn(),
    restoreWord: vi.fn(),
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

  afterEach(() => vi.restoreAllMocks());

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
      const input = el.querySelector<HTMLInputElement>('input')!;
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
