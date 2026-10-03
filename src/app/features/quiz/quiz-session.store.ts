import { computed, inject } from '@angular/core';
import { patchState, signalStore, withComputed, withMethods, withState } from '@ngrx/signals';
import { DeutschDeckDb } from '../../core/data/db';
import { Gender, Word } from '../../core/models/word.model';
import { checkAnswer } from '../../core/utils/quiz';

export type QuizStatus = 'setup' | 'playing' | 'done';

export interface QuizAnswer {
  word: Word;
  chosen: Gender;
  correct: boolean;
}

interface QuizSessionState {
  questions: Word[];
  currentIndex: number;
  selectedAnswer: Gender | null;
  answers: QuizAnswer[];
  status: QuizStatus;
}

const initialState: QuizSessionState = {
  questions: [],
  currentIndex: 0,
  selectedAnswer: null,
  answers: [],
  status: 'setup',
};

// Not providedIn: 'root' - the Quiz page provides this itself, so every
// visit to /quiz starts a brand-new session instead of resuming a stale
// one. Deliberately has no WordsStore dependency: the quiz is separate
// practice and never touches a word's Leitner box/dueAt.
export const QuizSessionStore = signalStore(
  withState<QuizSessionState>(initialState),
  withComputed(({ questions, currentIndex, answers }) => ({
    currentQuestion: computed<Word | undefined>(() => questions()[currentIndex()]),
    score: computed(() => answers().filter((a) => a.correct).length),
    // 1-based: "question 3 of 10", not "2 answered so far".
    progress: computed(() => ({
      current: Math.min(currentIndex() + 1, questions().length),
      total: questions().length,
    })),
  })),
  withMethods((store) => {
    const db = inject(DeutschDeckDb);

    return {
      start(words: Word[]): void {
        patchState(store, {
          questions: words,
          currentIndex: 0,
          selectedAnswer: null,
          answers: [],
          status: 'playing',
        });
      },

      // Grades immediately on selection (the UI shows right/wrong feedback
      // right away, not after a separate submit step). Ignored if this
      // question's already been answered, so a stray double-click can't
      // record two answers for the same card.
      selectAnswer(answer: Gender): void {
        if (store.selectedAnswer() !== null) {
          return;
        }
        const question = store.currentQuestion();
        if (!question) {
          return;
        }
        const correct = checkAnswer(question, answer);
        patchState(store, {
          selectedAnswer: answer,
          answers: [...store.answers(), { word: question, chosen: answer, correct }],
        });
      },

      next(): void {
        const nextIndex = store.currentIndex() + 1;
        const done = nextIndex >= store.questions().length;
        patchState(store, {
          currentIndex: nextIndex,
          selectedAnswer: null,
          status: done ? 'done' : 'playing',
        });

        if (done) {
          const correct = store.answers().filter((a) => a.correct).length;
          db.sessions.add({ date: Date.now(), type: 'quiz', total: store.answers().length, correct });
        }
      },

      // Back to the setup screen - mirrors StudySessionStore.reset().
      reset(): void {
        patchState(store, initialState);
      },
    };
  }),
);
