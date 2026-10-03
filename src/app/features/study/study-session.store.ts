import { computed, inject } from '@angular/core';
import { patchState, signalStore, withComputed, withMethods, withState } from '@ngrx/signals';
import { DeutschDeckDb } from '../../core/data/db';
import { Word } from '../../core/models/word.model';
import { WordsStore } from '../../core/state/words.store';
import { shuffle } from '../../core/utils/shuffle';

export type SessionStatus = 'setup' | 'studying' | 'done';

export interface SessionResult {
  word: Word;
  knewIt: boolean;
}

const SESSION_SIZE = 20;

interface StudySessionState {
  queue: Word[];
  currentIndex: number;
  isFlipped: boolean;
  results: SessionResult[];
  status: SessionStatus;
}

const initialState: StudySessionState = {
  queue: [],
  currentIndex: 0,
  isFlipped: false,
  results: [],
  status: 'setup',
};

// Not providedIn: 'root' - the Study page provides this itself (see its
// `providers` array), so every visit to /study starts a brand-new session
// instead of resuming a stale one from last time.
export const StudySessionStore = signalStore(
  withState<StudySessionState>(initialState),
  withComputed(({ queue, currentIndex }) => ({
    currentCard: computed<Word | undefined>(() => queue()[currentIndex()]),
    // 1-based: "card 3 of 20", not "2 completed so far".
    progress: computed(() => ({
      current: Math.min(currentIndex() + 1, queue().length),
      total: queue().length,
    })),
  })),
  withMethods((store) => {
    const wordsStore = inject(WordsStore);
    const db = inject(DeutschDeckDb);

    return {
      start(dueWords: Word[]): void {
        patchState(store, {
          queue: shuffle(dueWords).slice(0, SESSION_SIZE),
          currentIndex: 0,
          isFlipped: false,
          results: [],
          status: 'studying',
        });
      },

      flip(): void {
        patchState(store, { isFlipped: !store.isFlipped() });
      },

      answer(knewIt: boolean): void {
        const word = store.currentCard();
        if (!word) {
          return;
        }

        wordsStore.reviewWord(word.id!, knewIt);

        const results = [...store.results(), { word, knewIt }];
        const nextIndex = store.currentIndex() + 1;
        const done = nextIndex >= store.queue().length;
        patchState(store, {
          results,
          currentIndex: nextIndex,
          isFlipped: false,
          status: done ? 'done' : 'studying',
        });

        if (done) {
          const correct = results.filter((r) => r.knewIt).length;
          db.sessions.add({ date: Date.now(), type: 'study', total: results.length, correct });
        }
      },

      // Back to the setup screen - used when "Study again" finds nothing
      // left due, so we don't land on a blank studying view with no cards.
      reset(): void {
        patchState(store, initialState);
      },
    };
  }),
);
