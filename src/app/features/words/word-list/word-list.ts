import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { Word } from '../../../core/models/word.model';
import { ArticleBadge } from '../../../shared/article-badge/article-badge';

/**
 * The vocabulary list (or its "no results" state). Presentational - Words
 * owns the dialogs, so edit/delete are just emitted.
 */
@Component({
  selector: 'app-word-list',
  imports: [MatButtonModule, MatIconModule, ArticleBadge],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './word-list.html',
  styleUrl: './word-list.scss',
})
export class WordList {
  readonly words = input.required<Word[]>();
  /** Leave room under the last row for the mobile add FAB. */
  readonly fabSpace = input(false);

  readonly edit = output<Word>();
  readonly remove = output<Word>();
}
