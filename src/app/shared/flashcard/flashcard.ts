import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { Word } from '../../core/models/word.model';
import { ArticleBadge } from '../article-badge/article-badge';

@Component({
  selector: 'app-flashcard',
  imports: [ArticleBadge],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './flashcard.html',
  styleUrl: './flashcard.scss',
})
export class Flashcard {
  readonly word = input.required<Word>();
  readonly flipped = input(false);

  readonly toggle = output<void>();

  // The button's own name always identifies the card; a separate aria-live
  // region (below) is what makes screen readers announce the flip itself.
  protected readonly ariaLabel = computed(() =>
    this.flipped()
      ? `${this.word().german}. Press to show the German side again.`
      : `${this.word().german}. Press to reveal the English meaning.`,
  );

  protected readonly liveText = computed(() => {
    if (!this.flipped()) {
      return `Showing German: ${this.word().german}`;
    }
    const plural = this.word().plural ? `, plural ${this.word().plural}` : '';
    return `Showing English: ${this.word().english}${plural}`;
  });
}
