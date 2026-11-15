import { fingerprintText } from './fingerprint';

describe('fingerprintText', () => {
  const csv = 'German,English,Article,Level\nHaus,house,das,A1\n';

  it('is the same for the same text', () => {
    expect(fingerprintText(csv)).toBe(fingerprintText(csv));
  });

  it('ignores line-ending style and a trailing line break', () => {
    expect(fingerprintText(csv.replace(/\n/g, '\r\n'))).toBe(fingerprintText(csv));
    expect(fingerprintText(csv.trimEnd())).toBe(fingerprintText(csv));
  });

  it('differs when any word differs, even by one letter or only in case', () => {
    expect(fingerprintText(csv.replace('Haus', 'Maus'))).not.toBe(fingerprintText(csv));
    expect(fingerprintText(csv.replace('Haus', 'haus'))).not.toBe(fingerprintText(csv));
    expect(fingerprintText(csv + 'Tür,door,die,A1\n')).not.toBe(fingerprintText(csv));
  });
});
