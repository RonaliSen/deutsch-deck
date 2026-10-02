import { Word } from '../models/word.model';
import { filterWords, normalize } from './words.store';

function word(overrides: Partial<Word>): Word {
  return {
    german: 'Platzhalter',
    english: 'placeholder',
    level: 'A1',
    topic: 'Allgemein',
    box: 1,
    dueAt: 0,
    createdAt: 0,
    ...overrides,
  };
}

describe('normalize', () => {
  it('lowercases', () => {
    expect(normalize('APFEL')).toBe('apfel');
  });

  it('folds umlauts so "apfel" and "Äpfel" match', () => {
    expect(normalize('Äpfel')).toBe(normalize('apfel'));
  });

  it('folds ß to ss', () => {
    expect(normalize('Straße')).toBe('strasse');
  });
});

describe('filterWords', () => {
  const apfel = word({ german: 'Apfel', gender: 'der', plural: 'Äpfel', english: 'apple', level: 'A1' });
  const hund = word({ german: 'Hund', gender: 'der', plural: 'Hunde', english: 'dog', level: 'A1' });
  const tur = word({ german: 'Tür', gender: 'die', plural: 'Türen', english: 'door', level: 'A2' });
  const buch = word({ german: 'Buch', gender: 'das', english: 'book', level: 'B1' });
  const words = [apfel, hund, tur, buch];

  it('returns everything when search is empty and level is "all"', () => {
    expect(filterWords(words, '', 'all')).toEqual(words);
  });

  it('matches the German field, case-insensitively', () => {
    expect(filterWords(words, 'HUND', 'all')).toEqual([hund]);
  });

  it('matches the English field', () => {
    expect(filterWords(words, 'door', 'all')).toEqual([tur]);
  });

  it('is umlaut-insensitive: "apfel" matches german "Apfel"', () => {
    expect(filterWords(words, 'apfel', 'all')).toEqual([apfel]);
  });

  it('is umlaut-insensitive against the plural field too', () => {
    // German/English deliberately don't contain "apfel" here, so a match
    // can only come from folding the umlaut in the plural field.
    const onlyPluralMatches = word({ german: 'Frucht', english: 'fruit', plural: 'Äpfel' });
    expect(filterWords([onlyPluralMatches], 'apfel', 'all')).toEqual([onlyPluralMatches]);
  });

  it('matches a non-umlaut search term against a field that has an umlaut', () => {
    // "Tür" normalizes to "tur" - typing the plain ASCII form should find it.
    expect(filterWords(words, 'tur', 'all')).toEqual([tur]);
  });

  it('does not match topic - only german/english/plural are searched', () => {
    expect(filterWords(words, 'Allgemein', 'all')).toEqual([]);
  });

  it('filters by level alone', () => {
    expect(filterWords(words, '', 'A1')).toEqual([apfel, hund]);
  });

  it('combines level filter and search', () => {
    // "h" alone matches both Hund (A1) and Buch (B1); the level filter
    // should narrow that down to just the A1 one.
    expect(filterWords(words, 'h', 'A1')).toEqual([hund]);
  });

  it('returns an empty array when nothing matches', () => {
    expect(filterWords(words, 'xyz', 'all')).toEqual([]);
  });
});
