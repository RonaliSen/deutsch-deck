/**
 * A short id for a file's text, to recognise a file that was already
 * imported. Line endings are normalised first, so the same file re-saved
 * with CRLF vs LF (or with a trailing newline) still matches.
 *
 * cyrb53 (public domain, by bryc): a fast 53-bit string hash - plenty to
 * tell files apart. Not cryptographic, and doesn't need to be.
 */
export function fingerprintText(text: string): string {
  const normalised = text.replace(/\r\n?/g, '\n').trimEnd();
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < normalised.length; i++) {
    const ch = normalised.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36) + `-${normalised.length}`;
}
