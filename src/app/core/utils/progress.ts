import { Level, Word } from '../models/word.model';
import { isMastered } from './leitner';

// Local Y-M-D, not a UTC-based 24h bucket - two timestamps that fall on the
// same calendar day in the user's timezone must produce the same key, even
// across a DST change.
function toDayKey(timestamp: number): string {
  const date = new Date(timestamp);
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

function addDays(timestamp: number, days: number): number {
  const date = new Date(timestamp);
  date.setDate(date.getDate() + days);
  return date.getTime();
}

/**
 * Consecutive calendar days (counting back from today) with at least one
 * session. A day with no session yet is only a gap once it's actually
 * over - if today has nothing but yesterday does, the streak counts back
 * from yesterday instead of resetting to 0.
 */
export function computeStreak(sessionDates: readonly number[], now: number): number {
  const days = new Set(sessionDates.map(toDayKey));
  const todayKey = toDayKey(now);
  const yesterday = addDays(now, -1);

  let cursor: number;
  if (days.has(todayKey)) {
    cursor = now;
  } else if (days.has(toDayKey(yesterday))) {
    cursor = yesterday;
  } else {
    return 0;
  }

  let streak = 0;
  while (days.has(toDayKey(cursor))) {
    streak++;
    cursor = addDays(cursor, -1);
  }
  return streak;
}

export interface LevelStats {
  mastered: number;
  total: number;
  percent: number;
}

/** Mastered (box 5) / total / percent for each level, even ones with 0 words. */
export function levelProgress(words: readonly Word[]): Record<Level, LevelStats> {
  const levels: readonly Level[] = ['A1', 'A2', 'B1'];
  const result = {} as Record<Level, LevelStats>;

  for (const level of levels) {
    const levelWords = words.filter((word) => word.level === level);
    const mastered = levelWords.filter(isMastered).length;
    const total = levelWords.length;
    result[level] = { mastered, total, percent: total === 0 ? 0 : Math.round((mastered / total) * 100) };
  }

  return result;
}

export function greetingFor(date: Date): string {
  const hour = date.getHours();
  if (hour < 12) return 'Guten Morgen!';
  if (hour < 18) return 'Guten Tag!';
  return 'Guten Abend!';
}
