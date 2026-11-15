import { Word } from '../models/word.model';
import { INTERVAL_DAYS, isDue, isMastered, review } from './leitner';

const DAY_MS = 24 * 60 * 60 * 1000;

function word(overrides: Partial<Word>): Word {
  return {
    german: 'Haus',
    english: 'house',
    level: 'A1',
    topic: 'Allgemein',
    box: 1,
    dueAt: 0,
    createdAt: 0,
    ...overrides,
  };
}

// A fixed, known moment: 2026-03-10 15:30 local time.
const NOON_ISH = new Date(2026, 2, 10, 15, 30, 0, 0).getTime();
const START_OF_THAT_DAY = new Date(2026, 2, 10, 0, 0, 0, 0).getTime();

describe('INTERVAL_DAYS', () => {
  it('maps every box 1-5 to its day count', () => {
    expect(INTERVAL_DAYS).toEqual({ 1: 0, 2: 1, 3: 3, 4: 7, 5: 14 });
  });
});

describe('review', () => {
  it('bumps the box by one on a correct answer', () => {
    const result = review(word({ box: 2 }), true, NOON_ISH);
    expect(result.box).toBe(3);
  });

  it('caps the box at 5 - a correct answer at box 5 stays at 5', () => {
    const result = review(word({ box: 5 }), true, NOON_ISH);
    expect(result.box).toBe(5);
  });

  it('resets to box 1 on a wrong answer, no matter the starting box', () => {
    for (const startBox of [1, 2, 3, 4, 5]) {
      const result = review(word({ box: startBox }), false, NOON_ISH);
      expect(result.box).toBe(1);
    }
  });

  it('schedules a box-1 word (a miss) due at the start of today, not later', () => {
    const result = review(word({ box: 3 }), false, NOON_ISH);
    expect(result.dueAt).toBe(START_OF_THAT_DAY + INTERVAL_DAYS[1] * DAY_MS);
    expect(result.dueAt).toBe(START_OF_THAT_DAY); // interval is 0 days
  });

  it('schedules each box correctly at start-of-day + INTERVAL_DAYS[box]', () => {
    const cases: Array<[number, number]> = [
      [1, 2],
      [2, 3],
      [3, 4],
      [4, 5],
    ];
    for (const [fromBox, toBox] of cases) {
      const result = review(word({ box: fromBox }), true, NOON_ISH);
      expect(result.box).toBe(toBox);
      expect(result.dueAt).toBe(START_OF_THAT_DAY + INTERVAL_DAYS[toBox] * DAY_MS);
    }
  });

  it('ignores time-of-day: reviewing at 00:01 or 23:59 the same day gives the same dueAt', () => {
    const earlyMorning = new Date(2026, 2, 10, 0, 1, 0, 0).getTime();
    const lateNight = new Date(2026, 2, 10, 23, 59, 0, 0).getTime();

    const a = review(word({ box: 1 }), true, earlyMorning);
    const b = review(word({ box: 1 }), true, lateNight);
    expect(a.dueAt).toBe(b.dueAt);
  });

  it('only changes box and dueAt, leaving the rest of the word untouched', () => {
    const original = word({ box: 2, german: 'Katze', english: 'cat', createdAt: 123 });
    const result = review(original, true, NOON_ISH);
    expect(result.german).toBe('Katze');
    expect(result.english).toBe('cat');
    expect(result.createdAt).toBe(123);
  });
});

describe('isDue', () => {
  it('is true when dueAt is in the past', () => {
    expect(isDue(word({ dueAt: NOON_ISH - DAY_MS }), NOON_ISH)).toBe(true);
  });

  it('is true when dueAt is exactly now (boundary, inclusive)', () => {
    expect(isDue(word({ dueAt: NOON_ISH }), NOON_ISH)).toBe(true);
  });

  it('is false when dueAt is in the future', () => {
    expect(isDue(word({ dueAt: NOON_ISH + DAY_MS }), NOON_ISH)).toBe(false);
  });

  it('treats a word due yesterday as still due right after midnight today', () => {
    const dueYesterday = START_OF_THAT_DAY - DAY_MS; // start of the previous day
    const justAfterMidnightToday = START_OF_THAT_DAY + 60_000; // 00:01 today
    expect(isDue(word({ dueAt: dueYesterday }), justAfterMidnightToday)).toBe(true);
  });
});

describe('isMastered', () => {
  it('is true only at box 5', () => {
    expect(isMastered(word({ box: 5 }))).toBe(true);
  });

  it('is false below box 5', () => {
    for (const box of [1, 2, 3, 4]) {
      expect(isMastered(word({ box }))).toBe(false);
    }
  });
});
