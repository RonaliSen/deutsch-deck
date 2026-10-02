import { DeutschDeckDb } from './db';
import { Word } from '../models/word.model';

const now = () => Date.now();

const SEED_WORDS: Array<Omit<Word, 'id'>> = [
  { german: 'Tisch', gender: 'der', plural: 'Tische', english: 'table', level: 'A1', topic: 'Haus', box: 1, dueAt: now(), createdAt: now() },
  { german: 'Tür', gender: 'die', plural: 'Türen', english: 'door', level: 'A1', topic: 'Haus', box: 1, dueAt: now(), createdAt: now() },
  { german: 'Fenster', gender: 'das', plural: 'Fenster', english: 'window', level: 'A1', topic: 'Haus', box: 1, dueAt: now(), createdAt: now() },
  { german: 'Hund', gender: 'der', plural: 'Hunde', english: 'dog', level: 'A1', topic: 'Tiere', box: 1, dueAt: now(), createdAt: now() },
  { german: 'Katze', gender: 'die', plural: 'Katzen', english: 'cat', level: 'A1', topic: 'Tiere', box: 1, dueAt: now(), createdAt: now() },
  { german: 'Buch', gender: 'das', plural: 'Bücher', english: 'book', level: 'A1', topic: 'Schule', box: 1, dueAt: now(), createdAt: now() },
  { german: 'Apfel', gender: 'der', plural: 'Äpfel', english: 'apple', level: 'A1', topic: 'Essen', box: 1, dueAt: now(), createdAt: now() },
  { german: 'Banane', gender: 'die', plural: 'Bananen', english: 'banana', level: 'A1', topic: 'Essen', box: 1, dueAt: now(), createdAt: now() },
  { german: 'Wasser', gender: 'das', english: 'water', level: 'A1', topic: 'Essen', box: 1, dueAt: now(), createdAt: now() },
  { german: 'Zeit', gender: 'die', plural: 'Zeiten', english: 'time', level: 'A1', topic: 'Allgemein', box: 1, dueAt: now(), createdAt: now() },
];

/** Populates the words table with starter vocabulary, but only if it's empty. */
export async function seedWordsIfEmpty(db: DeutschDeckDb): Promise<void> {
  const count = await db.words.count();
  if (count > 0) {
    return;
  }
  await db.words.bulkAdd(SEED_WORDS as Word[]);
}
