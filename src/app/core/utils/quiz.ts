import { Gender, Word } from '../models/word.model';
import { shuffle } from './shuffle';

const DEFAULT_COUNT = 10;

/**
 * Picks words for an article (der/die/das) quiz: only nouns that have a
 * gender (not every word does), shuffled, capped at `count`.
 * `random` defaults to Math.random; pass a fixed one in tests.
 */
export function pickQuizWords(words: readonly Word[], count = DEFAULT_COUNT, random: () => number = Math.random): Word[] {
  const nouns = words.filter((word): word is Word & { gender: Gender } => !!word.gender);
  return shuffle(nouns, random).slice(0, count);
}

export function checkAnswer(word: Word, answer: Gender): boolean {
  return word.gender === answer;
}
