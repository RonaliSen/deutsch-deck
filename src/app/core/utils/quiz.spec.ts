import { Word } from '../models/word.model';
import { checkAnswer, pickQuizWords } from './quiz';

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

const alwaysZero = () => 0;

describe('pickQuizWords', () => {
  it('excludes words that have no gender', () => {
    const words = [word(1, { gender: 'der' }), word(2), word(3, { gender: 'die' }), word(4)];
    const result = pickQuizWords(words, 10, alwaysZero);
    expect(new Set(result.map((w) => w.id))).toEqual(new Set([1, 3]));
  });

  it('returns an empty array when there are no nouns at all', () => {
    const words = [word(1), word(2), word(3)];
    expect(pickQuizWords(words, 10, alwaysZero)).toEqual([]);
  });

  it('returns every noun when there are fewer than count', () => {
    const words = [word(1, { gender: 'der' }), word(2, { gender: 'die' }), word(3, { gender: 'das' })];
    const result = pickQuizWords(words, 10, alwaysZero);
    expect(result).toHaveLength(3);
    expect(new Set(result.map((w) => w.id))).toEqual(new Set([1, 2, 3]));
  });

  it('caps the result at count when there are more nouns available', () => {
    const words = Array.from({ length: 15 }, (_, i) => word(i + 1, { gender: 'der' }));
    const result = pickQuizWords(words, 10, alwaysZero);
    expect(result).toHaveLength(10);
    const validIds = new Set(words.map((w) => w.id));
    expect(result.every((w) => validIds.has(w.id!))).toBe(true);
  });

  it('defaults count to 10 when not given', () => {
    const words = Array.from({ length: 15 }, (_, i) => word(i + 1, { gender: 'der' }));
    expect(pickQuizWords(words, undefined, alwaysZero)).toHaveLength(10);
  });

  it('actually uses the injected random function (deterministic shuffle)', () => {
    const words = [1, 2, 3, 4, 5].map((id) => word(id, { gender: 'der' }));
    const result = pickQuizWords(words, 5, alwaysZero);
    // Hand-computed Fisher-Yates trace for 5 items with random always 0:
    // [1,2,3,4,5] -> [2,3,4,5,1]
    expect(result.map((w) => w.id)).toEqual([2, 3, 4, 5, 1]);
  });
});

describe('checkAnswer', () => {
  it('is true when the answer matches the word\'s gender', () => {
    expect(checkAnswer(word(1, { gender: 'der' }), 'der')).toBe(true);
  });

  it('is false when the answer does not match', () => {
    expect(checkAnswer(word(1, { gender: 'der' }), 'die')).toBe(false);
  });

  it('is false for a word with no gender, regardless of the answer', () => {
    expect(checkAnswer(word(1), 'der')).toBe(false);
  });
});
