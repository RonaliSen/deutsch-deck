// Checks a file-picker selection before anything tries to read it, so the
// Words page can show what was picked (or why it can't be used). Only the
// file itself is checked here - name, size, count - not its contents; the
// CSV is parsed in a later step.
//
// Plain functions, no Angular: tested as input -> output (see leitner.ts).

/** 1 MB - roughly 20,000 words, far more than any real vocabulary list. */
export const CSV_MAX_BYTES = 1024 * 1024;

export type CsvFileProblem = 'multiple' | 'not-csv' | 'empty' | 'too-large';

export type CsvFileCheck =
  | { ok: true; file: File }
  | {
      ok: false;
      problem: CsvFileProblem;
      /** The rejected file, or null when there's no single file to show. */
      file: File | null;
      /** What went wrong and what to do instead - shown to the user as is. */
      message: string;
    };

/**
 * Validates the files from an <input type="file">.
 * Returns null when nothing was picked (e.g. the picker was cancelled).
 */
export function checkCsvFile(files: ArrayLike<File> | null | undefined): CsvFileCheck | null {
  if (!files || files.length === 0) {
    return null;
  }
  if (files.length > 1) {
    return {
      ok: false,
      problem: 'multiple',
      file: null,
      message: `${files.length} files were selected. Choose just one CSV file.`,
    };
  }

  const file = files[0];
  // The extension, not file.type: browsers report CSVs inconsistently
  // ('text/csv', 'application/vnd.ms-excel' with Excel on Windows, or '').
  if (!/\.csv$/i.test(file.name)) {
    return {
      ok: false,
      problem: 'not-csv',
      file,
      message: 'This isn’t a CSV file. Choose a file ending in .csv.',
    };
  }
  if (file.size === 0) {
    return {
      ok: false,
      problem: 'empty',
      file,
      message: 'This file is empty. Choose a CSV file with at least one word in it.',
    };
  }
  if (file.size > CSV_MAX_BYTES) {
    return {
      ok: false,
      problem: 'too-large',
      file,
      // No rounded size in here: 1 MB + 1 byte would read "1 MB, limit 1 MB".
      message: `This file is over the ${formatFileSize(CSV_MAX_BYTES)} limit. Try splitting it into smaller files.`,
    };
  }
  return { ok: true, file };
}

const UNITS = ['KB', 'MB', 'GB'];

/** Human-readable size: "0 bytes", "1 byte", "842 bytes", "2.4 KB", "1 MB". */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} ${bytes === 1 ? 'byte' : 'bytes'}`;
  }
  let value = bytes / 1024;
  let unit = 0;
  // Step up on the *rounded* value, so 1,048,575 bytes reads "1 MB", not "1024 KB".
  while (roundToTenth(value) >= 1024 && unit < UNITS.length - 1) {
    value /= 1024;
    unit++;
  }
  return `${roundToTenth(value)} ${UNITS[unit]}`;
}

function roundToTenth(value: number): number {
  // Number(...) drops a trailing ".0": 2 KB, not 2.0 KB.
  return Number(value.toFixed(1));
}
