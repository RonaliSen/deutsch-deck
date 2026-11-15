import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { ArticleBadge } from '../../../shared/article-badge/article-badge';
import { PageBanner } from '../../../shared/page-banner/page-banner';
import { ScoreRing } from '../../../shared/score-ring/score-ring';
import { QuizAnswer } from '../quiz-session.store';

/** End-of-quiz screen: score, message and the wrong answers to review. */
@Component({
  selector: 'app-quiz-results',
  imports: [RouterLink, MatButtonModule, MatIconModule, ArticleBadge, PageBanner, ScoreRing],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './quiz-results.html',
  styleUrl: './quiz-results.scss',
})
export class QuizResults {
  readonly score = input.required<number>();
  readonly total = input.required<number>();
  /** "Perfect!" / "Great job!" / ... (Quiz.resultMessage). */
  readonly message = input.required<string>();
  readonly wrongAnswers = input.required<QuizAnswer[]>();

  readonly playAgain = output<void>();

  protected readonly percent = computed(() =>
    this.total() === 0 ? 0 : Math.round((this.score() / this.total()) * 100),
  );
}
