import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { MatIconModule } from '@angular/material/icon';
import { LevelFilter } from '../../../core/state/words.store';
import { PageBanner } from '../../../shared/page-banner/page-banner';

const LEVEL_CHIPS: readonly LevelFilter[] = ['all', 'A1', 'A2', 'B1'];

/**
 * Quiz setup screen: level filter and what the quiz will contain.
 * Presentational - Quiz owns the filter state and starts the quiz.
 */
@Component({
  selector: 'app-quiz-setup',
  imports: [RouterLink, MatButtonModule, MatChipsModule, MatIconModule, PageBanner],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './quiz-setup.html',
  styleUrl: './quiz-setup.scss',
})
export class QuizSetup {
  readonly level = input.required<LevelFilter>();
  /** Nouns (words with an article) at the selected level. */
  readonly nounCount = input.required<number>();
  /** Nouns across every level. */
  readonly globalNounCount = input.required<number>();
  readonly minNouns = input.required<number>();
  /** How many questions the quiz will have at this level. */
  readonly questionCount = input.required<number>();

  readonly levelChange = output<LevelFilter>();
  readonly start = output<void>();

  protected readonly levelChips = LEVEL_CHIPS;
}
