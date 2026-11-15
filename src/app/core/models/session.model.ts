export interface Session {
  id?: number;
  date: number;
  type: 'study' | 'quiz';
  total: number;
  correct: number;
}
