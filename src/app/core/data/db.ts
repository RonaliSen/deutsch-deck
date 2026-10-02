import Dexie, { Table } from 'dexie';
import { Word } from '../models/word.model';

export class DeutschDeckDb extends Dexie {
  words!: Table<Word, number>;

  constructor() {
    super('deutsch-deck');
    this.version(1).stores({
      words: '++id, level, topic, box, dueAt',
    });
  }
}

export const db = new DeutschDeckDb();
