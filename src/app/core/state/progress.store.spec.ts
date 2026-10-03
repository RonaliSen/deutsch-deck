import { TestBed } from '@angular/core/testing';
import { DeutschDeckDb } from '../data/db';
import { Session } from '../models/session.model';
import { Word } from '../models/word.model';
import { ProgressStore } from './progress.store';

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

function session(id: number, overrides: Partial<Session> = {}): Session {
  return { id, date: Date.now(), type: 'study', total: 10, correct: 8, ...overrides };
}

async function flush(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

/**
 * Polls until `check()` is true or `timeoutMs` elapses, then throws.
 * liveQuery resolves asynchronously, but not after any fixed number of
 * flushes - that was tried and is flaky (confirmed by running it 8x in a
 * row: 1-2 flushes passed sometimes, failed other times). Polling against
 * the actual expected state is the only reliable way to wait for it.
 */
async function waitUntil(check: () => boolean, timeoutMs = 1000): Promise<void> {
  const start = Date.now();
  while (!check()) {
    if (Date.now() - start > timeoutMs) {
      throw new Error('waitUntil: timed out waiting for condition');
    }
    await flush();
  }
}

function deleteTestDatabase(): Promise<void> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.deleteDatabase('deutsch-deck');
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

// ProgressStore's computeds read injectLiveWords()/injectLiveSessions(),
// which wrap Dexie's liveQuery() in toSignal(). liveQuery only emits for
// reads it can actually track through a real Dexie transaction - verified
// directly: a plain duck-typed fake ({ toArray: () => Promise.resolve(...) })
// produces zero emissions, ever, not even an initial one. So "a fake
// DeutschDeckDb" here means a REAL DeutschDeckDb (the real Dexie subclass,
// so liveQuery's tracking genuinely works) backed by a fake, in-memory
// IndexedDB (fake-indexeddb) instead of a real browser database - isolated,
// fast, no real persistence, but Dexie machinery is the genuine article.
beforeEach(async () => {
  await deleteTestDatabase();
});

async function setupStore(words: Word[], sessions: Session[]): Promise<InstanceType<typeof ProgressStore>> {
  const db = new DeutschDeckDb();
  await db.words.bulkAdd(words);
  await db.sessions.bulkAdd(sessions);

  TestBed.configureTestingModule({ providers: [{ provide: DeutschDeckDb, useValue: db }] });
  const store = TestBed.inject(ProgressStore);

  // @ngrx/signals only runs a withComputed factory on first property read,
  // not at store construction - so injectLiveWords()/injectLiveSessions()
  // (and their liveQuery subscriptions) don't exist yet until something
  // reads a computed. Reading them here starts both subscriptions; then we
  // wait until each one's signal actually reflects the seeded data - words
  // and sessions are two independent liveQuery subscriptions that resolve
  // on their own schedules. In the app itself none of this matters: the
  // template reads these on first render anyway, and change detection
  // re-renders automatically once liveQuery resolves, whenever that is.
  store.totalWords();
  store.lastSessions();
  await waitUntil(() => store.totalWords() === words.length && store.lastSessions().length === Math.min(sessions.length, 5));
  return store;
}

describe('ProgressStore', () => {
  it('totalWords and masteredWords reflect the live word list', async () => {
    const words = [word(1, { box: 5 }), word(2, { box: 3 }), word(3, { box: 5 })];
    const store = await setupStore(words, []);

    expect(store.totalWords()).toBe(3);
    expect(store.masteredWords()).toBe(2);
  });

  it('dueTodayCount only counts words due at or before now', async () => {
    const now = Date.now();
    const words = [
      word(1, { dueAt: now - 10_000 }), // due
      word(2, { dueAt: now - 1 }), // due
      word(3, { dueAt: now + 10_000_000 }), // not due
    ];
    const store = await setupStore(words, []);

    expect(store.dueTodayCount()).toBe(2);
  });

  it('levelProgress groups mastered/total/percent per level, including zero-word levels', async () => {
    const words = [
      word(1, { level: 'A1', box: 5 }),
      word(2, { level: 'A1', box: 1 }),
      word(3, { level: 'B1', box: 5 }),
    ];
    const store = await setupStore(words, []);

    expect(store.levelProgress()).toEqual({
      A1: { mastered: 1, total: 2, percent: 50 },
      A2: { mastered: 0, total: 0, percent: 0 },
      B1: { mastered: 1, total: 1, percent: 100 },
    });
  });

  it('streak is computed from session dates (1 for a session today)', async () => {
    const store = await setupStore([], [session(1, { date: Date.now() })]);

    expect(store.streak()).toBe(1);
  });

  it('streak is 0 when there are no sessions', async () => {
    const store = await setupStore([], []);

    expect(store.streak()).toBe(0);
  });

  it('lastSessions is sorted newest-first and capped at 5', async () => {
    const now = Date.now();
    const sessions = Array.from({ length: 8 }, (_, i) => session(i + 1, { date: now - i * 1_000 }));
    // Insert out of chronological order to prove the store sorts, not just passes through.
    const shuffled = [sessions[3], sessions[0], sessions[7], sessions[1], sessions[6], sessions[2], sessions[5], sessions[4]];

    const store = await setupStore([], shuffled);

    expect(store.lastSessions()).toHaveLength(5);
    expect(store.lastSessions().map((s) => s.id)).toEqual([1, 2, 3, 4, 5]);
  });
});
