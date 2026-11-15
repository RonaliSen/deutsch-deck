import { computed, inject } from '@angular/core';
import { patchState, signalStore, withComputed, withHooks, withMethods, withState } from '@ngrx/signals';
import { DeutschDeckDb } from '../data/db';
import { seedWordsIfEmpty } from '../data/seed-words';
import { Level, Word, WordInput } from '../models/word.model';
import { review } from '../utils/leitner';
import { wordKey } from '../utils/word-key';

export type LevelFilter = 'all' | Level;

interface WordsState {
  words: Word[];
  loading: boolean;
  searchTerm: string;
  levelFilter: LevelFilter;
}

// Case- and umlaut-insensitive: "apfel" should match "Apfel" and "Äpfel".
// NFD decomposes ä into a + combining diaeresis so the mark can be stripped;
// ß doesn't decompose that way, so it needs its own replace.
export function normalize(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/ß/g, 'ss')
    .toLowerCase();
}

// Pulled out of the computed signal below so it's testable as a plain
// function - no store, no Dexie, no Angular TestBed needed.
export function filterWords(words: Word[], searchTerm: string, levelFilter: LevelFilter): Word[] {
  const term = normalize(searchTerm.trim());

  return words.filter((word) => {
    if (levelFilter !== 'all' && word.level !== levelFilter) {
      return false;
    }
    if (!term) {
      return true;
    }
    return (
      normalize(word.german).includes(term) ||
      normalize(word.english).includes(term) ||
      (!!word.plural && normalize(word.plural).includes(term))
    );
  });
}

export const WordsStore = signalStore(
  { providedIn: 'root' },
  withState<WordsState>({ words: [], loading: false, searchTerm: '', levelFilter: 'all' }),
  withComputed(({ words, searchTerm, levelFilter }) => ({
    totalCount: computed(() => words().length),
    // "Due" = scheduled at or before now, same definition the Leitner box
    // review flow (a later milestone) will query by.
    dueTodayCount: computed(() => {
      const now = Date.now();
      return words().filter((word) => word.dueAt <= now).length;
    }),
    filteredWords: computed(() => filterWords(words(), searchTerm(), levelFilter())),
  })),
  withMethods((store) => {
    const db = inject(DeutschDeckDb);

    return {
      setSearchTerm(searchTerm: string): void {
        patchState(store, { searchTerm });
      },

      setLevelFilter(levelFilter: LevelFilter): void {
        patchState(store, { levelFilter });
      },

      async load(): Promise<void> {
        patchState(store, { loading: true });
        await seedWordsIfEmpty(db);
        const words = await db.words.toArray();
        patchState(store, { words, loading: false });
      },

      async addWord(input: WordInput): Promise<Word> {
        const now = Date.now();
        const word: Omit<Word, 'id'> = { ...input, box: 1, dueAt: now, createdAt: now };
        const id = await db.words.add(word as Word);
        const saved: Word = { ...word, id };
        patchState(store, { words: [...store.words(), saved] });
        return saved;
      },

      /**
       * Adds many words at once, skipping any that are already saved or
       * earlier in `inputs` (same German + English - see wordKey). Existing
       * words are never changed. New words start like addWord's: box 1,
       * due now.
       *
       * The duplicate check reads the database itself, not this store's
       * list (which is only complete once load() has finished), in the same
       * transaction as the write - so the check and the insert are atomic,
       * and a failed write saves none of the words.
       */
      async importWords(inputs: WordInput[]): Promise<{ added: Word[]; duplicates: number }> {
        const now = Date.now();
        const result = await db.transaction('rw', db.words, async () => {
          const seen = new Set((await db.words.toArray()).map(wordKey));
          const fresh = inputs.filter((input) => {
            const key = wordKey(input);
            if (seen.has(key)) {
              return false;
            }
            seen.add(key);
            return true;
          });
          const duplicates = inputs.length - fresh.length;
          if (fresh.length === 0) {
            return { added: [] as Word[], duplicates };
          }
          const words = fresh.map((input) => ({ ...input, box: 1, dueAt: now, createdAt: now }));
          const ids = await db.words.bulkAdd(words as Word[], { allKeys: true });
          return { added: words.map((word, i): Word => ({ ...word, id: ids[i] })), duplicates };
        });
        if (result.added.length > 0) {
          // One state update for the whole batch: the list and counts refresh once.
          patchState(store, { words: [...store.words(), ...result.added] });
        }
        return result;
      },

      // Editing word info only - box/dueAt (review progress) are untouched.
      async updateWord(id: number, changes: Partial<WordInput>): Promise<void> {
        await db.words.update(id, changes);
        patchState(store, {
          words: store.words().map((word) => (word.id === id ? { ...word, ...changes } : word)),
        });
      },

      async deleteWord(id: number): Promise<void> {
        await db.words.delete(id);
        patchState(store, { words: store.words().filter((word) => word.id !== id) });
      },

      // For "Undo" after a delete: puts the exact word back, same id and
      // review progress, as opposed to addWord's box 1/dueAt now reset.
      async restoreWord(word: Word): Promise<void> {
        await db.words.add(word);
        patchState(store, { words: [...store.words(), word] });
      },

      // Applies one Leitner review (see core/utils/leitner.ts) and persists it.
      async reviewWord(id: number, knewIt: boolean): Promise<void> {
        const word = store.words().find((w) => w.id === id);
        if (!word) {
          return;
        }
        const updated = review(word, knewIt, Date.now());
        await db.words.update(id, { box: updated.box, dueAt: updated.dueAt });
        patchState(store, { words: store.words().map((w) => (w.id === id ? updated : w)) });
      },
    };
  }),
  withHooks({
    onInit(store) {
      store.load();
    },
  }),
);
