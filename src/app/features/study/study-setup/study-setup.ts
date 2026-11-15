import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { PageBanner } from '../../../shared/page-banner/page-banner';
import { LevelFilter } from '../../../core/state/words.store';
import { SESSION_SIZE } from '../study-session.store';

const LEVEL_CHIPS: readonly LevelFilter[] = ['all', 'A1', 'A2', 'B1'];

/**
 * Study's setup screen: level/topic filters and the session summary.
 * Presentational - Study owns the filter state and starts the session.
 */
@Component({
  selector: 'app-study-setup',
  imports: [
    RouterLink,
    MatButtonModule,
    MatChipsModule,
    MatFormFieldModule,
    MatIconModule,
    MatSelectModule,
    PageBanner,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './study-setup.html',
  styleUrl: './study-setup.scss',
})
export class StudySetup {
  readonly level = input.required<LevelFilter>();
  readonly topic = input.required<string>();
  readonly topics = input.required<string[]>();
  /** Due words matching the current filters. */
  readonly dueCount = input.required<number>();
  /** Cards the next session will actually contain (due, capped). */
  readonly sessionSize = input.required<number>();
  /** Due words across everything, ignoring filters. */
  readonly globalDueCount = input.required<number>();

  readonly levelChange = output<LevelFilter>();
  readonly topicChange = output<string>();
  readonly start = output<void>();

  protected readonly levelChips = LEVEL_CHIPS;
  protected readonly sessionLimit = SESSION_SIZE;
}
