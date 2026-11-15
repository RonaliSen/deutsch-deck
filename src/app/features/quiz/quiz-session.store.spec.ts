import { TestBed } from '@angular/core/testing';
import { DeutschDeckDb } from '../../core/data/db';
import { Word } from '../../core/models/word.model';
import { QuizSessionStore } from './quiz-session.store';

function word(id: number, overrides: Partial<Word> = {}): Word {
  return {
    id,
    german: `Wort${id}`,
    gender: 'der',
    english: `word${id}`,
    level: 'A1',
    topic: 'Allgemein',
    box: 1,
    dueAt: 0,
    createdAt: 0,
    ...overrides,
  };
}

// QuizSessionStore writes a session row (type: 'quiz') via the injected
// DeutschDeckDb when a quiz finishes - fake it so tests don't touch real
// Dexie. Unlike StudySessionStore, it has no WordsStore dependency at all:
// the quiz never changes a word's Leitner box, so there's nothing to fake there.
function setupStore(): InstanceType<typeof QuizSessionStore> {
  TestBed.configureTestingModule({
    providers: [QuizSessionStore, { provide: DeutschDeckDb, useValue: { sessions: { add: vi.fn().mockResolvedValue(1) } } }],
  });
  return TestBed.inject(QuizSessionStore);
}

describe('QuizSessionStore', () => {
  describe('status', () => {
    it('starts in "setup"', () => {
      const store = setupStore();
      expect(store.status()).toBe('setup');
    });

    it('moves to "playing" once start() is called', () => {
      const store = setupStore();
      store.start([word(1, { gender: 'der' }), word(2, { gender: 'die' })]);
      expect(store.status()).toBe('playing');
    });

    it('moves to "done" only after next() on the last question, not before', () => {
      const store = setupStore();
      store.start([word(1, { gender: 'der' }), word(2, { gender: 'die' })]);

      store.selectAnswer('der');
      store.next();
      expect(store.status()).toBe('playing');

      store.selectAnswer('die');
      store.next();
      expect(store.status()).toBe('done');
    });

    it('reset() returns to "setup" with empty questions and answers', () => {
      const store = setupStore();
      store.start([word(1, { gender: 'der' })]);
      store.selectAnswer('der');
      store.next();
      expect(store.status()).toBe('done');

      store.reset();
      expect(store.status()).toBe('setup');
      expect(store.questions()).toEqual([]);
      expect(store.answers()).toEqual([]);
      expect(store.currentIndex()).toBe(0);
    });
  });

  describe('currentQuestion', () => {
    it('follows currentIndex through the queue', () => {
      const store = setupStore();
      const w1 = word(1, { gender: 'der' });
      const w2 = word(2, { gender: 'die' });
      store.start([w1, w2]);

      expect(store.currentQuestion()).toEqual(w1);
      store.selectAnswer('der');
      store.next();
      expect(store.currentQuestion()).toEqual(w2);
    });

    it('is undefined once the quiz is exhausted', () => {
      const store = setupStore();
      store.start([word(1, { gender: 'der' })]);
      store.selectAnswer('der');
      store.next();
      expect(store.currentQuestion()).toBeUndefined();
    });
  });

  describe('selectAnswer (grading)', () => {
    it('records a correct answer and increments score', () => {
      const store = setupStore();
      store.start([word(1, { gender: 'der' })]);
      store.selectAnswer('der');

      expect(store.selectedAnswer()).toBe('der');
      expect(store.score()).toBe(1);
      expect(store.answers()).toEqual([{ word: word(1, { gender: 'der' }), chosen: 'der', correct: true }]);
    });

    it('records a wrong answer without incrementing score', () => {
      const store = setupStore();
      store.start([word(1, { gender: 'der' })]);
      store.selectAnswer('die');

      expect(store.score()).toBe(0);
      expect(store.answers()).toEqual([{ word: word(1, { gender: 'der' }), chosen: 'die', correct: false }]);
    });

    it('ignores a second selection for the same question (no double-answer)', () => {
      const store = setupStore();
      store.start([word(1, { gender: 'der' })]);
      store.selectAnswer('der');
      store.selectAnswer('die'); // should be a no-op

      expect(store.selectedAnswer()).toBe('der');
      expect(store.answers()).toHaveLength(1);
      expect(store.score()).toBe(1);
    });

    it('does nothing if there is no current question', () => {
      const store = setupStore();
      // status is still 'setup' - currentQuestion() is undefined
      store.selectAnswer('der');
      expect(store.answers()).toEqual([]);
      expect(store.selectedAnswer()).toBeNull();
    });
  });

  describe('next', () => {
    it('resets selectedAnswer to null for the next question', () => {
      const store = setupStore();
      store.start([word(1, { gender: 'der' }), word(2, { gender: 'die' })]);
      store.selectAnswer('der');
      expect(store.selectedAnswer()).toBe('der');

      store.next();
      expect(store.selectedAnswer()).toBeNull();
    });
  });

  describe('score and progress over a full quiz', () => {
    it('tallies the final score correctly across a mixed-result quiz', () => {
      const store = setupStore();
      const words = [word(1, { gender: 'der' }), word(2, { gender: 'die' }), word(3, { gender: 'das' })];
      store.start(words);

      store.selectAnswer('der'); // correct
      store.next();
      store.selectAnswer('der'); // wrong (actual: die)
      store.next();
      store.selectAnswer('das'); // correct
      store.next();

      expect(store.status()).toBe('done');
      expect(store.score()).toBe(2);
      expect(store.answers()).toHaveLength(3);
    });

    it('progress is 1-based and caps "current" at "total" once done', () => {
      const store = setupStore();
      store.start([word(1, { gender: 'der' }), word(2, { gender: 'die' })]);
      expect(store.progress()).toEqual({ current: 1, total: 2 });

      store.selectAnswer('der');
      store.next();
      expect(store.progress()).toEqual({ current: 2, total: 2 });

      store.selectAnswer('die');
      store.next();
      expect(store.progress()).toEqual({ current: 2, total: 2 });
    });
  });
});
