import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { ImportRecord, previousImportMessage } from '../../../core/state/import-history';
import { CsvImportPlan, CsvPreview as CsvPreviewData } from '../../../core/utils/csv-import';
import { ArticleBadge } from '../../../shared/article-badge/article-badge';

/** Rendering every row of a 1 MB file (~20,000) would stall the page. */
export const PREVIEW_ROW_LIMIT = 100;
export const PREVIEW_ERROR_LIMIT = 50;

/**
 * What an imported CSV would add: counts, the rows with errors (and why),
 * and a table of the valid words, duplicates marked. Presentational -
 * nothing is saved here.
 */
@Component({
  selector: 'app-csv-preview',
  imports: [MatIconModule, ArticleBadge],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './csv-preview.html',
  styleUrl: './csv-preview.scss',
})
export class CsvPreview {
  readonly preview = input.required<Extract<CsvPreviewData, { ok: true }>>();
  /** Which valid rows are new and which are duplicates. */
  readonly plan = input.required<CsvImportPlan>();
  /** When this same file was imported before. */
  readonly previousImport = input<ImportRecord | null>(null);

  protected readonly previousImportText = computed(() => {
    const record = this.previousImport();
    return record ? previousImportMessage(record, this.plan().newWords.length) : '';
  });

  protected readonly rowLimit = PREVIEW_ROW_LIMIT;
  protected readonly shownWords = computed(() => this.preview().words.slice(0, PREVIEW_ROW_LIMIT));
  protected readonly shownErrors = computed(() =>
    this.preview().errors.slice(0, PREVIEW_ERROR_LIMIT),
  );
  protected readonly hiddenErrorCount = computed(
    () => this.preview().errors.length - this.shownErrors().length,
  );
}
