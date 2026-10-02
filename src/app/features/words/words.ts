import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Subject, debounceTime, distinctUntilChanged } from 'rxjs';
import { injectIsDesktop } from '../../core/layout/breakpoints';
import { Word } from '../../core/models/word.model';
import { LevelFilter, WordsStore } from '../../core/state/words.store';
import { ConfirmDialog } from '../../shared/confirm-dialog/confirm-dialog';
import { ArticleBadge } from '../../shared/article-badge/article-badge';
import { WordDialog } from './word-dialog/word-dialog';

const LEVEL_CHIPS: readonly LevelFilter[] = ['all', 'A1', 'A2', 'B1'];

@Component({
  selector: 'app-words',
  imports: [MatButtonModule, MatChipsModule, MatFormFieldModule, MatIconModule, MatInputModule, ArticleBadge],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './words.html',
  styleUrl: './words.scss',
})
export class Words {
  protected readonly wordsStore = inject(WordsStore);
  protected readonly levelChips = LEVEL_CHIPS;
  protected readonly isDesktop = injectIsDesktop();
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);

  // Local, immediate echo of what's typed; the store's searchTerm (which
  // actually drives filtering) only updates after the debounce below.
  protected readonly searchText = signal('');

  private readonly search$ = new Subject<string>();

  constructor() {
    this.search$
      .pipe(debounceTime(200), distinctUntilChanged(), takeUntilDestroyed())
      .subscribe((term) => this.wordsStore.setSearchTerm(term));
  }

  protected onSearchInput(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.searchText.set(value);
    this.search$.next(value);
  }

  protected onLevelChipChange(level: LevelFilter): void {
    this.wordsStore.setLevelFilter(level);
  }

  protected onAdd(): void {
    this.dialog
      .open(WordDialog, { width: '480px' })
      .afterClosed()
      .subscribe((result) => {
        if (result) {
          this.wordsStore.addWord(result);
        }
      });
  }

  protected onEdit(word: Word): void {
    this.dialog
      .open(WordDialog, { data: { word }, width: '480px' })
      .afterClosed()
      .subscribe((result) => {
        if (result) {
          this.wordsStore.updateWord(word.id!, result);
        }
      });
  }

  protected onDelete(word: Word): void {
    this.dialog
      .open(ConfirmDialog, {
        data: {
          title: 'Delete word?',
          message: `"${word.german}" (${word.english}) will be removed.`,
          confirmText: 'Delete',
        },
        width: '360px',
      })
      .afterClosed()
      .subscribe((confirmed) => {
        if (!confirmed) {
          return;
        }
        this.wordsStore.deleteWord(word.id!);
        this.snackBar
          .open('Word deleted', 'Undo', { duration: 5000 })
          .onAction()
          .subscribe(() => this.wordsStore.restoreWord(word));
      });
  }
}
