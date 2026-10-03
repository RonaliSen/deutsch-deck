import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  afterNextRender,
  computed,
  input,
  output,
  viewChild,
} from '@angular/core';
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

  private readonly cardButton = viewChild<ElementRef<HTMLButtonElement>>('cardButton');

  constructor() {
    // Study keys each word's <app-flashcard> by id (see study.html), so a
    // new word is a brand-new component instance - focus doesn't carry
    // over from the previous card's button the way it would if the same
    // instance were reused. Re-focus here so keyboard users (Space/1/2)
    // keep working across cards without reaching for the mouse.
    afterNextRender(() => this.cardButton()?.nativeElement.focus());
  }

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
