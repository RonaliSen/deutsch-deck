import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { Level } from '../../../core/models/word.model';
import { LevelStats } from '../../../core/utils/progress';

const LEVELS: readonly Level[] = ['A1', 'A2', 'B1'];

// Official CEFR names, shown next to each level badge.
const LEVEL_NAMES: Record<Level, string> = {
  A1: 'Beginner',
  A2: 'Elementary',
  B1: 'Intermediate',
};

/** Mastered/total per CEFR level, one colored progress row each. */
@Component({
  selector: 'app-level-progress',
  imports: [MatProgressBarModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './level-progress.html',
  styleUrl: './level-progress.scss',
})
export class LevelProgress {
  readonly progress = input.required<Record<Level, LevelStats>>();
  readonly mastered = input.required<number>();
  readonly total = input.required<number>();

  protected readonly levels = LEVELS;
  protected readonly levelNames = LEVEL_NAMES;
}
