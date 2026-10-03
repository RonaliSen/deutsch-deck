import { Word } from '../models/word.model';
import { computeStreak, greetingFor, levelProgress } from './progress';

function at(year: number, month: number, day: number, hour = 12, minute = 0, second = 0): number {
  return new Date(year, month - 1, day, hour, minute, second).getTime();
}

const NOW = at(2026, 3, 15, 14, 30); // Sunday 2026-03-15, 14:30

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

describe('computeStreak', () => {
  it('is 0 when there are no sessions at all', () => {
    expect(computeStreak([], NOW)).toBe(0);
  });

  it('counts multiple sessions on the same day as one day', () => {
    const today = [at(2026, 3, 15, 9), at(2026, 3, 15, 13), at(2026, 3, 15, 20)];
    expect(computeStreak(today, NOW)).toBe(1);
  });

  it('stays alive with no session yet today, as long as yesterday has one', () => {
    const dates = [at(2026, 3, 14, 10), at(2026, 3, 13, 10)];
    expect(computeStreak(dates, NOW)).toBe(2);
  });

  it('a gap breaks the streak - older sessions past the gap do not count', () => {
    // today and yesterday present, then a gap (3/13 missing), then 3/12 present.
    const dates = [at(2026, 3, 15, 9), at(2026, 3, 14, 9), at(2026, 3, 12, 9)];
    expect(computeStreak(dates, NOW)).toBe(2);
  });

  it('is 0 when the most recent session is neither today nor yesterday', () => {
    const dates = [at(2026, 3, 12, 9)];
    expect(computeStreak(dates, NOW)).toBe(0);
  });

  it('uses local calendar days, not 24-hour buckets, around midnight', () => {
    // These two timestamps are ~2 seconds apart but fall on different
    // calendar days - a 24h-bucket implementation could easily merge or
    // split them wrong.
    const justBeforeMidnight = at(2026, 3, 14, 23, 59, 59);
    const justAfterMidnight = at(2026, 3, 15, 0, 0, 1);
    const nowOnTheSecondDay = at(2026, 3, 15, 10);

    expect(computeStreak([justBeforeMidnight, justAfterMidnight], nowOnTheSecondDay)).toBe(2);
  });
});

describe('levelProgress', () => {
  it('returns zeros for every level when there are no words', () => {
    expect(levelProgress([])).toEqual({
      A1: { mastered: 0, total: 0, percent: 0 },
      A2: { mastered: 0, total: 0, percent: 0 },
      B1: { mastered: 0, total: 0, percent: 0 },
    });
  });

  it('counts mastered (box 5) vs total per level and computes percent', () => {
    const words = [
      word(1, { level: 'A1', box: 5 }),
      word(2, { level: 'A1', box: 3 }),
      word(3, { level: 'A1', box: 1 }),
      word(4, { level: 'B1', box: 5 }),
      word(5, { level: 'B1', box: 5 }),
    ];
    // A2 deliberately has zero words.
    expect(levelProgress(words)).toEqual({
      A1: { mastered: 1, total: 3, percent: 33 },
      A2: { mastered: 0, total: 0, percent: 0 },
      B1: { mastered: 2, total: 2, percent: 100 },
    });
  });
});

describe('greetingFor', () => {
  it('says Guten Morgen! before noon', () => {
    expect(greetingFor(new Date(2026, 2, 15, 0, 0))).toBe('Guten Morgen!');
    expect(greetingFor(new Date(2026, 2, 15, 11, 59))).toBe('Guten Morgen!');
  });

  it('says Guten Tag! from noon until 18:00', () => {
    expect(greetingFor(new Date(2026, 2, 15, 12, 0))).toBe('Guten Tag!');
    expect(greetingFor(new Date(2026, 2, 15, 17, 59))).toBe('Guten Tag!');
  });

  it('says Guten Abend! from 18:00 onward', () => {
    expect(greetingFor(new Date(2026, 2, 15, 18, 0))).toBe('Guten Abend!');
    expect(greetingFor(new Date(2026, 2, 15, 23, 59))).toBe('Guten Abend!');
  });
});
