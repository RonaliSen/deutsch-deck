import { formatDate } from '@angular/common';
import { Injectable } from '@angular/core';

/** One finished CSV import, remembered to spot the same file coming back. */
export interface ImportRecord {
  /** fingerprintText() of the file's text. */
  fingerprint: string;
  fileName: string;
  /** Timestamp (ms). */
  importedAt: number;
  added: number;
}

const STORAGE_KEY = 'deutschdeck-csv-imports';
/** Plenty for "did I already import this?" - and it keeps the entry small. */
const MAX_RECORDS = 50;

/**
 * Which CSV files were already imported, kept in localStorage (like the
 * theme setting) so it survives reloads. Best effort: if storage is
 * unavailable or full, imports still work - they just aren't recognised.
 */
@Injectable({ providedIn: 'root' })
export class ImportHistory {
  /** The latest import of a file with this fingerprint, if any. */
  find(fingerprint: string): ImportRecord | undefined {
    return this.read().find((record) => record.fingerprint === fingerprint);
  }

  record(record: ImportRecord): void {
    const others = this.read().filter((r) => r.fingerprint !== record.fingerprint);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify([record, ...others].slice(0, MAX_RECORDS)));
    } catch {
      // Storage full or blocked (e.g. some private modes): not worth failing the import over.
    }
  }

  private read(): ImportRecord[] {
    try {
      const parsed: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]');
      return Array.isArray(parsed) ? parsed.filter(isRecord) : [];
    } catch {
      return [];
    }
  }
}

function isRecord(value: unknown): value is ImportRecord {
  const r = value as ImportRecord;
  return (
    typeof r?.fingerprint === 'string' &&
    typeof r.fileName === 'string' &&
    typeof r.importedAt === 'number' &&
    typeof r.added === 'number'
  );
}

/**
 * "You already imported this file on 15 Nov 2026 at 18:25." - plus, when
 * some of its words were deleted since, that importing again brings them
 * back. Shown on the preview and announced to screen readers.
 */
export function previousImportMessage(record: ImportRecord, newCount: number): string {
  const when = formatDate(record.importedAt, "d MMM y 'at' HH:mm", 'en-US');
  const comeBack =
    newCount === 1
      ? ' Importing it again adds back 1 word that is no longer in your list.'
      : ` Importing it again adds back ${newCount} words that are no longer in your list.`;
  return `You already imported this file on ${when}.${newCount > 0 ? comeBack : ''}`;
}
