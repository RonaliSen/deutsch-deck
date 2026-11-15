export type Gender = 'der' | 'die' | 'das';
export type Level = 'A1' | 'A2' | 'B1';

export interface Word {
  id?: number;
  german: string;
  gender?: Gender;
  plural?: string;
  english: string;
  level: Level;
  topic: string;
  /** Leitner box, 1-5. Higher box = reviewed further apart. */
  box: number;
  /** Timestamp (ms) - when this word is next due for review. */
  dueAt: number;
  createdAt: number;
}

/** Fields a user actually fills in. box/dueAt/createdAt are system-assigned. */
export type WordInput = Omit<Word, 'id' | 'box' | 'dueAt' | 'createdAt'>;
