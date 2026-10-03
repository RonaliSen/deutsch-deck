import { inject, Signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { liveQuery } from 'dexie';
import { from } from 'rxjs';
import { DeutschDeckDb } from './db';
import { Session } from '../models/session.model';
import { Word } from '../models/word.model';

/**
 * Live, read-only views of the words/sessions tables. Unlike WordsStore
 * (which caches state and patches it after each write it makes itself),
 * these re-query whenever ANYTHING writes to the table - a review in
 * Study, a session saved from Quiz, an edit on the Words page - so the
 * Home dashboard stays correct without the write-side code needing to
 * know the dashboard exists or notify it manually.
 *
 * toSignal, not rxMethod: rxMethod is for imperatively triggering a
 * side-effecting pipeline from changing input (e.g. "load word by id
 * whenever this id signal changes"). There's no input here - liveQuery
 * already watches the whole table on its own - so this is just "turn an
 * Observable into a Signal," which is exactly what toSignal is for.
 */
export function injectLiveWords(): Signal<Word[]> {
  const db = inject(DeutschDeckDb);
  return toSignal(from(liveQuery(() => db.words.toArray())), { initialValue: [] });
}

export function injectLiveSessions(): Signal<Session[]> {
  const db = inject(DeutschDeckDb);
  return toSignal(from(liveQuery(() => db.sessions.toArray())), { initialValue: [] });
}
