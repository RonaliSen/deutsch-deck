import { computed } from '@angular/core';
import { patchState, signalStore, withComputed, withHooks, withMethods, withState } from '@ngrx/signals';
import { db } from '../data/db';
import { seedWordsIfEmpty } from '../data/seed-words';
import { Word } from '../models/word.model';

interface WordsState {
  words: Word[];
  loading: boolean;
}

export const WordsStore = signalStore(
  { providedIn: 'root' },
  withState<WordsState>({ words: [], loading: false }),
  withComputed(({ words }) => ({
    totalCount: computed(() => words().length),
    // "Due" = scheduled at or before now, same definition the Leitner box
    // review flow (a later milestone) will query by.
    dueTodayCount: computed(() => {
      const now = Date.now();
      return words().filter((word) => word.dueAt <= now).length;
    }),
  })),
  withMethods((store) => ({
    async load(): Promise<void> {
      patchState(store, { loading: true });
      await seedWordsIfEmpty(db);
      const words = await db.words.toArray();
      patchState(store, { words, loading: false });
    },
  })),
  withHooks({
    onInit(store) {
      store.load();
    },
  }),
);
