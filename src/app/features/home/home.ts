import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { WordsStore } from '../../core/state/words.store';

@Component({
  selector: 'app-home',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h1>Home</h1>
    @if (wordsStore.loading()) {
      <p>Loading…</p>
    } @else {
      <p>{{ wordsStore.totalCount() }} words loaded, {{ wordsStore.dueTodayCount() }} due today</p>
    }
  `,
})
export class Home {
  protected readonly wordsStore = inject(WordsStore);
}
