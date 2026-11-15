import { scoreTone } from './recent-activity';

describe('scoreTone', () => {
  it('buckets a percent into great (80+), ok (50-79) and low (<50)', () => {
    expect(scoreTone(100)).toBe('great');
    expect(scoreTone(80)).toBe('great');
    expect(scoreTone(79)).toBe('ok');
    expect(scoreTone(50)).toBe('ok');
    expect(scoreTone(49)).toBe('low');
    expect(scoreTone(0)).toBe('low');
  });
});
