import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { Word } from '../../../core/models/word.model';
import { ScoreRing } from '../../../shared/score-ring/score-ring';
import { PageBanner } from '../../../shared/page-banner/page-banner';
import { ArticleBadge } from '../../../shared/article-badge/article-badge';

/** End-of-session screen: score and the words that were missed. */
@Component({
  selector: 'app-study-summary',
  imports: [RouterLink, MatButtonModule, MatIconModule, ArticleBadge, PageBanner, ScoreRing],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './study-summary.html',
  styleUrl: './study-summary.scss',
})
export class StudySummary {
  readonly knownCount = input.required<number>();
  readonly missedWords = input.required<Word[]>();

  readonly studyAgain = output<void>();

  protected readonly knownPercent = computed(() => {
    const total = this.knownCount() + this.missedWords().length;
    return total === 0 ? 0 : Math.round((this.knownCount() / total) * 100);
  });
}
