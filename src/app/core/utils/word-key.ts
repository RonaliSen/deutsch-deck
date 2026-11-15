import { Word } from '../models/word.model';

/**
 * What makes two words "the same word", for skipping duplicates on import:
 * the same German *and* the same English. That's the pair the starter
 * list and the v3 migration already dedupe by (see seed-words.ts, db.ts),
 * and it keeps real homographs apart - der See (lake) / die See (sea),
 * essen (to eat) / das Essen (food).
 *
 * Unlike the seed key, it's forgiving about how a file was typed:
 * - case-insensitive ("haus, House" matches "Haus, house")
 * - runs of spaces count as one
 * - Unicode-normalised (NFC): files from a Mac often store "ä" as "a" +
 *   a combining mark, which looks identical but wouldn't compare equal.
 */
export function wordKey(word: Pick<Word, 'german' | 'english'>): string {
  return `${canonical(word.german)}::${canonical(word.english)}`;
}

function canonical(text: string): string {
  return text.normalize('NFC').trim().replace(/\s+/g, ' ').toLowerCase();
}
