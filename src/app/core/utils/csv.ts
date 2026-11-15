// A small RFC 4180 CSV reader: quoted fields, delimiters / line breaks /
// doubled "" quotes inside quotes, CRLF or LF (or old-Mac CR) line endings.
// Plain functions, no Angular - tested as input -> output.

export type CsvDelimiter = ',' | ';';

export interface CsvRecord {
  /**
   * 1-based position among the file's records - the header is row 1. This
   * is the row number a spreadsheet shows, even when a quoted value spans
   * several lines of the raw text.
   */
  row: number;
  fields: string[];
}

export type CsvParseResult =
  | { ok: true; records: CsvRecord[] }
  /** A quote was opened and never closed - everything after it is unreadable. */
  | { ok: false; row: number };

/**
 * Decodes file bytes as UTF-8 (a leading byte-order mark is dropped), or -
 * if they aren't valid UTF-8 - as Windows-1252, which is what Excel on
 * Windows saves "CSV" as: without the fallback, "Bär" would read "B�r".
 */
export function decodeCsvBytes(bytes: Uint8Array): string {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    return new TextDecoder('windows-1252').decode(bytes);
  }
}

/**
 * Picks the delimiter from the header line: ';' if it has more semicolons
 * than commas (Excel uses ';' wherever the decimal separator is a comma,
 * e.g. a German locale), ',' otherwise.
 */
export function detectDelimiter(text: string): CsvDelimiter {
  const headerLine = text.trimStart().split(/\r\n|\n|\r/, 1)[0];
  const count = (char: string) => headerLine.split(char).length - 1;
  return count(';') > count(',') ? ';' : ',';
}

export function parseCsv(text: string, delimiter: CsvDelimiter = ','): CsvParseResult {
  const records: CsvRecord[] = [];
  let fields: string[] = [];
  let field = '';
  let inQuotes = false;
  let quoteRow = 0;
  let i = 0;

  const endField = () => {
    fields.push(field);
    field = '';
  };
  const endRecord = () => {
    endField();
    records.push({ row: records.length + 1, fields });
    fields = [];
  };

  while (i < text.length) {
    const char = text[i];

    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"'; // "" inside quotes is one literal quote
          i += 2;
          continue;
        }
        inQuotes = false;
      } else {
        field += char; // delimiters and line breaks are literal in here
      }
      i++;
      continue;
    }

    if (char === '"' && field === '') {
      inQuotes = true;
      quoteRow = records.length + 1;
    } else if (char === delimiter) {
      endField();
    } else if (char === '\r' || char === '\n') {
      endRecord();
      if (char === '\r' && text[i + 1] === '\n') {
        i++;
      }
    } else {
      // Lenient, like spreadsheets: a stray quote mid-value, or text after
      // a closing quote, is kept as is rather than rejected.
      field += char;
    }
    i++;
  }

  if (inQuotes) {
    return { ok: false, row: quoteRow };
  }
  // The last record, unless the text ended with a line break (or is empty).
  if (field !== '' || fields.length > 0) {
    endRecord();
  }
  return { ok: true, records };
}

// --- Writing ---

/**
 * One field, quoted only when it has to be (RFC 4180): when it holds the
 * delimiter, a quote or a line break. Quotes inside are doubled. Exactly
 * what parseCsv reads back.
 */
export function formatCsvField(value: string, delimiter: CsvDelimiter = ','): string {
  return value.includes(delimiter) || /["\r\n]/.test(value)
    ? `"${value.replace(/"/g, '""')}"`
    : value;
}

/** Rows to CSV text, CRLF line endings (RFC 4180, and what Excel writes). */
export function formatCsv(
  rows: readonly (readonly string[])[],
  delimiter: CsvDelimiter = ',',
): string {
  return rows
    .map(
      (fields) => fields.map((field) => formatCsvField(field, delimiter)).join(delimiter) + '\r\n',
    )
    .join('');
}
