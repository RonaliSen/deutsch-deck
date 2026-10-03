import { TestBed } from '@angular/core/testing';
import { DeutschDeckDb } from '../../core/data/db';
import { Word } from '../../core/models/word.model';
import { WordsStore } from '../../core/state/words.store';
import { StudySessionStore } from './study-session.store';

function word(id: number, overrides: Partial<Word> = {}): Word {
  return {
    id,
    german: `Wort${id}`,
    english: `word${id}`,
    level: 'A1',
    topic: 'Allgemein',
    box: 1,
    dueAt: 0,
    createdAt: 0,
    ...overrides,
  };
}

// StudySessionStore calls wordsStore.reviewWord() and db.sessions.add() -
// both go through Angular DI (DeutschDeckDb is an @Injectable, see db.ts),
// so TestBed providers can swap in fakes instead of touching real Dexie.
// Faking WordsStore entirely (rather than letting the real one run) keeps
// this a true unit test of StudySessionStore's own queue/flip/results/
// status logic, with its one real collaborator stubbed out.
function setupStore(): InstanceType<typeof StudySessionStore> {
  TestBed.configureTestingModule({
    providers: [
      StudySessionStore,
      { provide: WordsStore, useValue: { reviewWord: vi.fn() } },
      { provide: DeutschDeckDb, useValue: { sessions: { add: vi.fn().mockResolvedValue(1) } } },
    ],
  });
  return TestBed.inject(StudySessionStore);
}

describe('StudySessionStore', () => {
  describe('status', () => {
    it('starts in "setup"', () => {
      const store = setupStore();
      expect(store.status()).toBe('setup');
    });

    it('moves to "studying" once start() is called', () => {
      const store = setupStore();
      store.start([word(1), word(2)]);
      expect(store.status()).toBe('studying');
    });

    it('moves to "done" only once the last card is answered, not before', () => {
      const store = setupStore();
      store.start([word(1), word(2)]);

      store.flip();
      store.answer(true);
      expect(store.status()).toBe('studying');

      store.flip();
      store.answer(true);
      expect(store.status()).toBe('done');
    });

    it('reset() returns to "setup" with empty queue and results', () => {
      const store = setupStore();
      store.start([word(1)]);
      store.flip();
      store.answer(true);
      expect(store.status()).toBe('done');

      store.reset();
      expect(store.status()).toBe('setup');
      expect(store.queue()).toEqual([]);
      expect(store.results()).toEqual([]);
      expect(store.currentIndex()).toBe(0);
    });
  });

  describe('queue', () => {
    it('contains every word given, when 20 or fewer', () => {
      const store = setupStore();
      const words = [word(1), word(2), word(3)];
      store.start(words);
      expect(store.queue()).toHaveLength(3);
      expect(new Set(store.queue().map((w) => w.id))).toEqual(new Set([1, 2, 3]));
    });

    it('caps the session at 20 words even if more are due', () => {
      const store = setupStore();
      const words = Array.from({ length: 25 }, (_, i) => word(i + 1));
      store.start(words);
      expect(store.queue()).toHaveLength(20);
      // every queued word must be one of the 25 originals
      const validIds = new Set(words.map((w) => w.id));
      expect(store.queue().every((w) => validIds.has(w.id!))).toBe(true);
    });

    it('shuffles - repeated starts do not always produce the same order', () => {
      const store = setupStore();
      const words = Array.from({ length: 15 }, (_, i) => word(i + 1));

      const firstCardIds = Array.from({ length: 20 }, () => {
        store.start(words);
        return store.queue()[0].id;
      });

      // With 15 distinct items, the odds every one of 20 trials landed on
      // the same first card by pure chance are effectively zero.
      expect(new Set(firstCardIds).size).toBeGreaterThan(1);
    });
  });

  describe('flipping', () => {
    it('starts unflipped and toggles with flip()', () => {
      const store = setupStore();
      store.start([word(1)]);
      expect(store.isFlipped()).toBe(false);

      store.flip();
      expect(store.isFlipped()).toBe(true);

      store.flip();
      expect(store.isFlipped()).toBe(false);
    });

    it('resets to unflipped when answer() advances to the next card', () => {
      const store = setupStore();
      store.start([word(1), word(2)]);
      store.flip();
      expect(store.isFlipped()).toBe(true);

      store.answer(true);
      expect(store.isFlipped()).toBe(false);
    });
  });

  describe('results', () => {
    it('records one result per answer, in order, with the right word and knewIt', () => {
      const store = setupStore();
      store.start([word(1), word(2)]);
      // start() shuffles, so read the actual order rather than assuming it.
      const [first, second] = store.queue();

      store.flip();
      store.answer(true);
      store.flip();
      store.answer(false);

      expect(store.results()).toEqual([
        { word: first, knewIt: true },
        { word: second, knewIt: false },
      ]);
    });

    it('does nothing if answer() is called with no current card', () => {
      const store = setupStore();
      // status is still 'setup', queue is empty - currentCard() is undefined
      store.answer(true);
      expect(store.results()).toEqual([]);
      expect(store.status()).toBe('setup');
    });
  });

  describe('currentCard and progress', () => {
    it('currentCard follows currentIndex through the queue', () => {
      const store = setupStore();
      store.start([word(1), word(2)]);
      // start() shuffles, so read the actual order rather than assuming it.
      const [first, second] = store.queue();

      expect(store.currentCard()).toEqual(first);
      store.flip();
      store.answer(true);
      expect(store.currentCard()).toEqual(second);
    });

    it('currentCard is undefined once the queue is exhausted', () => {
      const store = setupStore();
      store.start([word(1)]);
      store.flip();
      store.answer(true);
      expect(store.currentCard()).toBeUndefined();
    });

    it('progress is 1-based and caps "current" at "total" once done', () => {
      const store = setupStore();
      store.start([word(1), word(2)]);
      expect(store.progress()).toEqual({ current: 1, total: 2 });

      store.flip();
      store.answer(true);
      expect(store.progress()).toEqual({ current: 2, total: 2 });

      store.flip();
      store.answer(true);
      // currentIndex is now 2 (past the end) but current must not exceed total
      expect(store.progress()).toEqual({ current: 2, total: 2 });
    });
  });
});
