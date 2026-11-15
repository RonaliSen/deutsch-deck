import { Injectable } from '@angular/core';
import Dexie, { Table } from 'dexie';
import { Session } from '../models/session.model';
import { Word } from '../models/word.model';
import { buildSeedWords } from './seed-words';

// An injectable (providedIn: 'root') rather than a plain exported
// singleton, so tests can swap it out via Angular's TestBed instead of
// needing module-level mocking (which the Angular unit-test builder
// doesn't support for relative imports).
@Injectable({ providedIn: 'root' })
export class DeutschDeckDb extends Dexie {
  words!: Table<Word, number>;
  sessions!: Table<Session, number>;

  constructor() {
    super('deutsch-deck');

    this.version(1).stores({
      words: '++id, level, topic, box, dueAt',
    });

    // v2: adds the sessions table (study/quiz results). Dexie versions are
    // cumulative schema snapshots, not diffs - every table must be restated
    // at each version, including ones that didn't change ("words" here),
    // because any table left out of a version's stores() is dropped. A
    // browser that already has a v1 database upgrades in place next time it
    // opens: Dexie runs the v1 -> v2 schema diff, which here is "add a store
    // called sessions" - existing word rows are untouched since "words" is
    // unchanged. A .upgrade() callback would only be needed if we had to
    // transform existing rows (e.g. rename a field); we don't, since
    // sessions is a brand-new table with nothing to migrate into it.
    this.version(2).stores({
      words: '++id, level, topic, box, dueAt',
      sessions: '++id, date, type',
    });

    // v3: the schema itself doesn't change (same stores() as v2, restated
    // because Dexie needs the full snapshot every version) - this version
    // exists purely to run an .upgrade() callback, which fires once, only
    // for browsers that already have a v2-or-earlier database. New users
    // never run it: seedWordsIfEmpty() already inserts the full current
    // word list (SEED_WORDS + EXTRA_WORDS) into their empty table via the
    // app's own startup code, not via a migration.
    //
    // Existing users' tables aren't empty - seedWordsIfEmpty() already ran
    // once and will never run again - so the 76 new words from EXTRA_WORDS
    // would otherwise never reach them. The upgrade callback below inserts
    // only the ones actually missing (matched by german+english, same key
    // buildSeedWords() already dedupes with), leaving every existing row -
    // and critically, its box/dueAt Leitner progress - completely alone.
    this.version(3)
      .stores({
        words: '++id, level, topic, box, dueAt',
        sessions: '++id, date, type',
      })
      .upgrade(async (tx) => {
        const existing = await tx.table<Word, number>('words').toArray();
        const existingKeys = new Set(existing.map((word) => `${word.german}::${word.english}`));
        const missing = buildSeedWords().filter((word) => !existingKeys.has(`${word.german}::${word.english}`));
        if (missing.length > 0) {
          await tx.table('words').bulkAdd(missing);
        }
      });
  }
}
