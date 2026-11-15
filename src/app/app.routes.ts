import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', loadComponent: () => import('./features/home/home').then((m) => m.Home) },
  { path: 'study', loadComponent: () => import('./features/study/study').then((m) => m.Study), title: 'Study' },
  { path: 'quiz', loadComponent: () => import('./features/quiz/quiz').then((m) => m.Quiz), title: 'Quiz' },
  { path: 'words', loadComponent: () => import('./features/words/words').then((m) => m.Words), title: 'My words' },
];
