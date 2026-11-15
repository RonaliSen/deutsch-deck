import { downloadTextFile } from './download';

// jsdom has no object URLs: stand-ins that keep the Blob for inspection.
describe('downloadTextFile', () => {
  let blobs: Blob[];
  let revoked: string[];
  let clicked: HTMLAnchorElement[];

  beforeEach(() => {
    vi.useFakeTimers();
    blobs = [];
    revoked = [];
    clicked = [];
    URL.createObjectURL = vi.fn((blob: Blob) => {
      blobs.push(blob);
      return `blob:test/${blobs.length}`;
    });
    URL.revokeObjectURL = vi.fn((url: string) => void revoked.push(url));
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      clicked.push(this);
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('clicks a hidden download link for the text, then cleans up', async () => {
    downloadTextFile('words.csv', 'German\r\n');

    expect(clicked).toHaveLength(1);
    expect(clicked[0].download).toBe('words.csv');
    expect(clicked[0].href).toBe('blob:test/1');
    expect(clicked[0].isConnected).toBe(false); // removed again
    expect(blobs[0].type).toBe('text/csv;charset=utf-8');
    expect(await blobs[0].text()).toBe('German\r\n');

    expect(revoked).toEqual([]); // not in the same tick as the click
    vi.runAllTimers();
    expect(revoked).toEqual(['blob:test/1']);
  });

  it('can prefix a UTF-8 byte-order mark', async () => {
    downloadTextFile('words.csv', 'Bär', { bom: true });

    const bytes = new Uint8Array(await blobs[0].arrayBuffer());
    expect([...bytes.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
    expect(new TextDecoder().decode(bytes)).toBe('Bär'); // the decoder drops the BOM
  });
});
