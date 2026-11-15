// `import type`, not a plain import: db.ts needs buildSeedWords() for its
// v3 migration below, which would make this a circular import at runtime
// if DeutschDeckDb were pulled in as a value here too. It's only ever used
// as a parameter type, so `import type` erases it at compile time and
// breaks the cycle.
import type { DeutschDeckDb } from './db';
import { Word } from '../models/word.model';
import { EXTRA_WORDS } from './extra-words';

const now = () => Date.now();

const SEED_WORDS: Array<Omit<Word, 'id'>> = [
  {
    german: 'Tisch',
    gender: 'der',
    plural: 'Tische',
    english: 'table',
    level: 'A1',
    topic: 'Haus',
    box: 1,
    dueAt: now(),
    createdAt: now(),
  },
  {
    german: 'Tür',
    gender: 'die',
    plural: 'Türen',
    english: 'door',
    level: 'A1',
    topic: 'Haus',
    box: 1,
    dueAt: now(),
    createdAt: now(),
  },
  {
    german: 'Fenster',
    gender: 'das',
    plural: 'Fenster',
    english: 'window',
    level: 'A1',
    topic: 'Haus',
    box: 1,
    dueAt: now(),
    createdAt: now(),
  },
  {
    german: 'Hund',
    gender: 'der',
    plural: 'Hunde',
    english: 'dog',
    level: 'A1',
    topic: 'Tiere',
    box: 1,
    dueAt: now(),
    createdAt: now(),
  },
  {
    german: 'Katze',
    gender: 'die',
    plural: 'Katzen',
    english: 'cat',
    level: 'A1',
    topic: 'Tiere',
    box: 1,
    dueAt: now(),
    createdAt: now(),
  },
  {
    german: 'Buch',
    gender: 'das',
    plural: 'Bücher',
    english: 'book',
    level: 'A1',
    topic: 'Schule',
    box: 1,
    dueAt: now(),
    createdAt: now(),
  },
  {
    german: 'Apfel',
    gender: 'der',
    plural: 'Äpfel',
    english: 'apple',
    level: 'A1',
    topic: 'Essen',
    box: 1,
    dueAt: now(),
    createdAt: now(),
  },
  {
    german: 'Banane',
    gender: 'die',
    plural: 'Bananen',
    english: 'banana',
    level: 'A1',
    topic: 'Essen',
    box: 1,
    dueAt: now(),
    createdAt: now(),
  },
  {
    german: 'Wasser',
    gender: 'das',
    english: 'water',
    level: 'A1',
    topic: 'Essen',
    box: 1,
    dueAt: now(),
    createdAt: now(),
  },
  {
    german: 'Zeit',
    gender: 'die',
    plural: 'Zeiten',
    english: 'time',
    level: 'A1',
    topic: 'Allgemein',
    box: 1,
    dueAt: now(),
    createdAt: now(),
  },
];

function seedKey(word: Pick<Word, 'german' | 'english'>): string {
  return `${word.german}::${word.english}`;
}

/**
 * SEED_WORDS + EXTRA_WORDS, deduped by german+english. SEED_WORDS always
 * wins a collision (it's seeded first, so later EXTRA_WORDS entries with
 * the same pair are the ones skipped) - there are 5 actual overlaps today
 * (Tisch, Tür, Fenster, Banane, Wasser all appear in both lists).
 */
export function buildSeedWords(): Array<Omit<Word, 'id'>> {
  const seen = new Set(SEED_WORDS.map(seedKey));
  const extras: Array<Omit<Word, 'id'>> = [];

  for (const word of EXTRA_WORDS) {
    const key = seedKey(word);
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    extras.push({ ...word, box: 1, dueAt: now(), createdAt: now() });
  }

  return [...SEED_WORDS, ...extras];
}

/** Populates the words table with starter vocabulary, but only if it's empty. */
export async function seedWordsIfEmpty(db: DeutschDeckDb): Promise<void> {
  const count = await db.words.count();
  if (count > 0) {
    return;
  }
  await db.words.bulkAdd(buildSeedWords() as Word[]);
}
