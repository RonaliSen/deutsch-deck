import { computed } from '@angular/core';
import { signalStore, withComputed } from '@ngrx/signals';
import { injectLiveSessions, injectLiveWords } from '../data/live-queries';
import { isDue, isMastered } from '../utils/leitner';
import { computeStreak, levelProgress as computeLevelProgress } from '../utils/progress';

const RECENT_SESSIONS_COUNT = 5;

// No withState: there's no local mutable state here, everything is derived
// straight from the live Dexie signals (see live-queries.ts) - this store
// is purely a computed view over them.
export const ProgressStore = signalStore(
  { providedIn: 'root' },
  withComputed(() => {
    const words = injectLiveWords();
    const sessions = injectLiveSessions();

    return {
      totalWords: computed(() => words().length),
      masteredWords: computed(() => words().filter(isMastered).length),
      dueTodayCount: computed(() => words().filter((word) => isDue(word, Date.now())).length),
      streak: computed(() => computeStreak(sessions().map((s) => s.date), Date.now())),
      levelProgress: computed(() => computeLevelProgress(words())),
      lastSessions: computed(() => [...sessions()].sort((a, b) => b.date - a.date).slice(0, RECENT_SESSIONS_COUNT)),
    };
  }),
);
