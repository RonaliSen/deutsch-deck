import { wordKey } from './word-key';

describe('wordKey', () => {
  it('is the same for the same German and English', () => {
    expect(wordKey({ german: 'Haus', english: 'house' })).toBe(
      wordKey({ german: 'Haus', english: 'house' }),
    );
  });

  it('ignores case, surrounding spaces and repeated spaces', () => {
    expect(wordKey({ german: ' haus ', english: 'House' })).toBe(
      wordKey({ german: 'Haus', english: 'house' }),
    );
    expect(wordKey({ german: 'Guten  Morgen', english: 'good   morning' })).toBe(
      wordKey({ german: 'Guten Morgen', english: 'good morning' }),
    );
  });

  it('matches umlauts however they are encoded (macOS files decompose them)', () => {
    const decomposed = 'Ba\u0308r'; // "a" + combining diaeresis
    const composed = 'B\u00e4r'; // "ä"
    expect(decomposed).not.toBe(composed);
    expect(wordKey({ german: decomposed, english: 'bear' })).toBe(
      wordKey({ german: composed, english: 'bear' }),
    );
  });

  it('keeps homographs apart by their English', () => {
    expect(wordKey({ german: 'See', english: 'lake' })).not.toBe(
      wordKey({ german: 'See', english: 'sea' }),
    );
  });

  it('does not fold umlauts or ß - they are different words', () => {
    expect(wordKey({ german: 'schon', english: 'x' })).not.toBe(
      wordKey({ german: 'schön', english: 'x' }),
    );
    expect(wordKey({ german: 'Masse', english: 'x' })).not.toBe(
      wordKey({ german: 'Maße', english: 'x' }),
    );
  });
});
