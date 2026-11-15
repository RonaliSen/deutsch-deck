import { TestBed } from '@angular/core/testing';
import { DeutschDeckDb } from '../data/db';
import { Word, WordInput } from '../models/word.model';
import { WordsStore, filterWords, normalize } from './words.store';

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

// Real Dexie on fake-indexeddb (loaded in test-setup.ts), not a stub: the
// point is that imported words really are saved, and duplicates really
// aren't.
describe('WordsStore.importWords', () => {
  let db: DeutschDeckDb;
  let store: InstanceType<typeof WordsStore>;

  beforeEach(async () => {
    TestBed.configureTestingModule({});
    db = TestBed.inject(DeutschDeckDb);
    await db.delete();
    await db.open();
    store = TestBed.inject(WordsStore); // loads (and seeds the starter words)
    await vi.waitFor(() => expect(store.loading()).toBe(false));
  });

  afterEach(() => db.close());

  const input = (german: string, english: string, extra: Partial<WordInput> = {}): WordInput => ({
    german,
    english,
    level: 'A1',
    topic: 'other',
    ...extra,
  });

  it('saves new words and adds them to the list and count at once', async () => {
    const before = store.totalCount();

    const result = await store.importWords([
      input('Regenschirm', 'umbrella', { gender: 'der', level: 'A2' }), // not a starter word
      input('laufen', 'to run'),
    ]);

    expect(result.duplicates).toBe(0);
    expect(result.added.map((w) => w.german)).toEqual(['Regenschirm', 'laufen']);
    expect(store.totalCount()).toBe(before + 2);
    // Persisted, with ids, and starting like addWord's words: box 1, due now.
    const saved = await db.words
      .where('id')
      .anyOf(result.added.map((w) => w.id!))
      .toArray();
    expect(saved).toHaveLength(2);
    expect(saved[0]).toMatchObject({
      german: 'Regenschirm',
      english: 'umbrella',
      gender: 'der',
      level: 'A2',
      topic: 'other',
      box: 1,
    });
    expect(saved[0].dueAt).toBeLessThanOrEqual(Date.now());
    expect(store.words().filter((w) => w.german === 'laufen')).toHaveLength(1);
  });

  it('skips words already in the list, leaving the existing word untouched', async () => {
    const existing = store.words().find((w) => w.german === 'Tisch')!;
    await db.words.update(existing.id!, { box: 4 }); // some review progress
    const before = await db.words.count();

    const result = await store.importWords([
      input('tisch', 'TABLE', { level: 'B1', topic: 'other' }), // same word, other details
      input('Sofa', 'sofa'),
    ]);

    expect(result.duplicates).toBe(1);
    expect(result.added.map((w) => w.german)).toEqual(['Sofa']);
    expect(await db.words.count()).toBe(before + 1);
    const tisch = await db.words.get(existing.id!);
    expect(tisch).toMatchObject({ german: 'Tisch', level: existing.level, box: 4 });
  });

  it('adds a word only once when it appears twice in the batch', async () => {
    const result = await store.importWords([input('Sofa', 'sofa'), input('SOFA', 'Sofa')]);

    expect(result).toMatchObject({ duplicates: 1 });
    expect(await db.words.filter((w) => w.german.toLowerCase() === 'sofa').count()).toBe(1);
  });

  it('checks the saved words, not just the loaded list', async () => {
    // Saved behind the store's back, e.g. by another tab: not in store.words().
    await db.words.add({ ...input('Regenschirm', 'umbrella'), box: 3, dueAt: 0, createdAt: 0 });
    expect(store.words().some((w) => w.german === 'Regenschirm')).toBe(false);

    const result = await store.importWords([input('Regenschirm', 'umbrella')]);

    expect(result).toEqual({ added: [], duplicates: 1 });
    expect(await db.words.filter((w) => w.german === 'Regenschirm').count()).toBe(1);
  });

  it('writes nothing when every word is a duplicate', async () => {
    const before = await db.words.count();
    const bulkAdd = vi.spyOn(db.words, 'bulkAdd');

    const result = await store.importWords([input('Tisch', 'table')]);

    expect(result).toEqual({ added: [], duplicates: 1 });
    expect(bulkAdd).not.toHaveBeenCalled();
    expect(await db.words.count()).toBe(before);
  });

  it('saves nothing, and leaves the list alone, if the write fails', async () => {
    const before = store.totalCount();
    vi.spyOn(db.words, 'bulkAdd').mockRejectedValueOnce(new Error('QuotaExceededError'));

    await expect(store.importWords([input('Sofa', 'sofa')])).rejects.toThrow('QuotaExceededError');

    expect(store.totalCount()).toBe(before);
    expect(await db.words.filter((w) => w.german === 'Sofa').count()).toBe(0);
  });
});
