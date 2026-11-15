import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { Word } from '../../../core/models/word.model';
import { ArticleBadge } from '../../../shared/article-badge/article-badge';

/**
 * Right/wrong panel shown after answering, with the full noun (article +
 * plural) and the button to move on. Screen readers get the same verdict
 * from Quiz's aria-live region, which is announced as it changes.
 */
@Component({
  selector: 'app-quiz-feedback',
  imports: [MatButtonModule, MatIconModule, ArticleBadge],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './quiz-feedback.html',
  styleUrl: './quiz-feedback.scss',
})
export class QuizFeedback {
  readonly word = input.required<Word>();
  readonly correct = input.required<boolean>();
  /** Last question: the button reads "See results" instead of "Next question". */
  readonly last = input.required<boolean>();

  readonly next = output<void>();
}
