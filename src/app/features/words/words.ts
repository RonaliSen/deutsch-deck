import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  inject,
  computed,
  signal,
  viewChild,
} from '@angular/core';
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
import { ImportHistory, previousImportMessage } from '../../core/state/import-history';
import { LevelFilter, WordsStore } from '../../core/state/words.store';
import { decodeCsvBytes } from '../../core/utils/csv';
import { csvExportFileName, wordsToCsv } from '../../core/utils/csv-export';
import { checkCsvFile, formatFileSize } from '../../core/utils/csv-file';
import { buildCsvPreview, planCsvImport, toWordInput } from '../../core/utils/csv-import';
import { downloadTextFile } from '../../core/utils/download';
import { fingerprintText } from '../../core/utils/fingerprint';
import { ConfirmDialog } from '../../shared/confirm-dialog/confirm-dialog';
import { PageBanner } from '../../shared/page-banner/page-banner';
import { CsvFilePanel, CsvImportState } from './csv-file-panel/csv-file-panel';
import { WordDialog } from './word-dialog/word-dialog';
import { WordList } from './word-list/word-list';

const LEVEL_CHIPS: readonly LevelFilter[] = ['all', 'A1', 'A2', 'B1'];

@Component({
  selector: 'app-words',
  imports: [
    MatButtonModule,
    MatChipsModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    CsvFilePanel,
    PageBanner,
    WordList,
  ],
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
  private readonly importHistory = inject(ImportHistory);

  // Local, immediate echo of what's typed; the store's searchTerm (which
  // actually drives filtering) only updates after the debounce below.
  protected readonly searchText = signal('');

  private readonly search$ = new Subject<string>();

  /** Hidden native file picker behind the "Import CSV" button. */
  private readonly csvFileInput = viewChild.required<ElementRef<HTMLInputElement>>('csvFileInput');
  private readonly importCsvButton = viewChild.required('importCsvButton', { read: ElementRef });

  /** The file picked for import and how far it got; null = none picked. */
  protected readonly csvImport = signal<CsvImportState | null>(null);

  /**
   * Which previewed rows are new and which are duplicates. Live while
   * previewing (the word list may change meanwhile, e.g. via Add word);
   * frozen while importing, when every saved word would turn "duplicate".
   */
  protected readonly csvPlan = computed(() => {
    const state = this.csvImport();
    if (state?.step === 'importing') {
      return state.plan;
    }
    return state?.step === 'preview'
      ? planCsvImport(state.preview.words, this.wordsStore.words())
      : null;
  });

  /** Screen-reader echo of csvImport - the picker itself says nothing once it closes. */
  protected readonly csvLiveText = computed(() => {
    const state = this.csvImport();
    switch (state?.step) {
      case undefined:
      case 'reading': // usually a blink - announcing it would just be noise
      case 'importing':
      case 'done': // focus moves to the result, which reads it out
        return '';
      case 'invalid':
        return state.file
          ? `Can’t use ${state.file.name}. ${state.message}`
          : `Can’t use this selection. ${state.message}`;
      case 'preview': {
        const plan = this.csvPlan()!;
        const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
        const counts = [
          `${plural(plan.newWords.length, 'new word', 'new words')} to import`,
          plan.duplicates.size
            ? `${plural(plan.duplicates.size, 'duplicate', 'duplicates')} to skip`
            : '',
          state.preview.errors.length
            ? `${plural(state.preview.errors.length, 'row', 'rows')} with errors`
            : '',
        ].filter(Boolean);
        const again = state.previousImport
          ? ` ${previousImportMessage(state.previousImport, plan.newWords.length)}`
          : '';
        return `Selected ${state.file.name}, ${formatFileSize(state.file.size)}. ${counts.join(', ')}.${again}`;
      }
    }
  });

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

  protected onImportCsv(): void {
    this.csvFileInput().nativeElement.click();
  }

  protected onCsvFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const check = checkCsvFile(input.files);
    // Reset, so picking the same file again (e.g. after fixing it) still
    // fires (change).
    input.value = '';
    // Nothing picked: keep whatever is already shown.
    if (!check) {
      return;
    }
    if (!check.ok) {
      this.csvImport.set({ step: 'invalid', file: check.file, message: check.message });
      return;
    }
    void this.readCsv(check.file);
  }

  /** Reads and parses a picked file into a preview. Nothing is saved yet. */
  private async readCsv(file: File): Promise<void> {
    this.csvImport.set({ step: 'reading', file });
    let next: CsvImportState;
    try {
      const text = decodeCsvBytes(new Uint8Array(await file.arrayBuffer()));
      const preview = buildCsvPreview(text);
      const fingerprint = fingerprintText(text);
      next = preview.ok
        ? {
            step: 'preview',
            file,
            preview,
            fingerprint,
            previousImport: this.importHistory.find(fingerprint),
          }
        : { step: 'invalid', file, message: preview.message };
    } catch {
      next = {
        step: 'invalid',
        file,
        message:
          'This file couldn’t be read. It may have been moved or changed since you chose it. ' +
          'Choose it again.',
      };
    }
    // Another file picked, or Cancel pressed, while this one was read: drop it.
    const current = this.csvImport();
    if (current?.step === 'reading' && current.file === file) {
      this.csvImport.set(next);
    }
  }

  /** Saves the previewed file's new words; duplicates and error rows are skipped. */
  protected async onCsvImportWords(): Promise<void> {
    const state = this.csvImport();
    const plan = this.csvPlan();
    // Also ignores a second click while the first import is saving.
    if (state?.step !== 'preview' || !plan) {
      return;
    }
    const { file, preview, fingerprint, previousImport } = state;
    this.csvImport.set({ step: 'importing', file, preview, fingerprint, previousImport, plan });
    try {
      // All valid rows: the store re-checks duplicates against what's saved.
      const { added, duplicates } = await this.wordsStore.importWords(
        preview.words.map(toWordInput),
      );
      // Remembered so the same file, picked again later, is recognised.
      this.importHistory.record({
        fingerprint,
        fileName: file.name,
        importedAt: Date.now(),
        added: added.length,
      });
      this.csvImport.set({
        step: 'done',
        file,
        added: added.length,
        duplicates,
        errors: preview.errors.length,
      });
    } catch {
      this.csvImport.set({
        step: 'preview',
        file,
        preview,
        fingerprint,
        previousImport,
        saveError: 'The words couldn’t be saved, so nothing was imported. Please try again.',
      });
    }
  }

  protected onCsvCancel(): void {
    this.csvImport.set(null);
    // Cancel is gone with the panel; don't strand keyboard focus on <body>.
    this.importCsvButton().nativeElement.focus();
  }

  /**
   * Downloads every saved word - words(), not filteredWords(): search and
   * the level filter don't narrow the export - in the import's format.
   */
  protected onExportCsv(): void {
    const words = this.wordsStore.words();
    const fileName = csvExportFileName(new Date());
    downloadTextFile(fileName, wordsToCsv(words), { bom: true });

    const count = `${words.length} ${words.length === 1 ? 'word' : 'words'}`;
    this.snackBar.open(
      words.length > 0
        ? `Exported ${count} to ${fileName}`
        : `Your list is empty, so ${fileName} has just the header row, ready to fill in`,
      undefined,
      { duration: 5000 },
    );
  }

  protected onAdd(): void {
    this.dialog
      .open(WordDialog, {
        width: this.isDesktop() ? '560px' : '100vw',
        maxWidth: this.isDesktop() ? '90vw' : '100vw',
        ariaModal: true,
        panelClass: 'app-dialog-panel',
        backdropClass: 'app-dialog-backdrop',
      })
      .afterClosed()
      .subscribe((result) => {
        if (result) {
          this.wordsStore.addWord(result);
        }
      });
  }

  protected onEdit(word: Word): void {
    this.dialog
      .open(WordDialog, {
        data: { word },
        width: this.isDesktop() ? '560px' : '100vw',
        maxWidth: this.isDesktop() ? '90vw' : '100vw',
        ariaModal: true,
        panelClass: 'app-dialog-panel',
        backdropClass: 'app-dialog-backdrop',
      })
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
          icon: 'delete',
        },
        width: '400px',
        maxWidth: '90vw',
        ariaModal: true,
        panelClass: 'app-dialog-panel',
        backdropClass: 'app-dialog-backdrop',
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
