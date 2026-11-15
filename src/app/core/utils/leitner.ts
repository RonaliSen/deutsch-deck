import { Word } from '../models/word.model';

const DAY_MS = 24 * 60 * 60 * 1000;

/** Days until a word in this box is due again, counted from the day it's reviewed. */
export const INTERVAL_DAYS: Record<number, number> = { 1: 0, 2: 1, 3: 3, 4: 7, 5: 14 };

function startOfDay(timestamp: number): number {
  const date = new Date(timestamp);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

/**
 * Applies one Leitner review. Knowing it moves the word up a box (capped at
 * 5); missing it always drops it back to box 1, due again today - the box-1
 * interval is 0 days, so a missed word can resurface later in the same
 * session, not just "sometime".
 */
export function review(word: Word, knewIt: boolean, now: number): Word {
  const box = knewIt ? Math.min(word.box + 1, 5) : 1;
  const dueAt = startOfDay(now) + INTERVAL_DAYS[box] * DAY_MS;
  return { ...word, box, dueAt };
}

export function isDue(word: Word, now: number): boolean {
  return word.dueAt <= now;
}

export function isMastered(word: Word): boolean {
  return word.box === 5;
}
