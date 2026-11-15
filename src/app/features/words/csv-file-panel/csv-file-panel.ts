import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  effect,
  input,
  output,
  viewChild,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { ImportRecord } from '../../../core/state/import-history';
import { formatFileSize } from '../../../core/utils/csv-file';
import { CsvImportPlan, CsvPreview as CsvPreviewData } from '../../../core/utils/csv-import';
import { CsvPreview } from '../csv-preview/csv-preview';

type ValidPreview = Extract<CsvPreviewData, { ok: true }>;

/** A file read into a preview. */
interface Previewed {
  file: File;
  preview: ValidPreview;
  /** fingerprintText() of its text - to recognise it if it's picked again. */
  fingerprint: string;
  /** Set when this same file was imported before. */
  previousImport?: ImportRecord;
}

/** Where a picked CSV is: unusable, being read, previewed, being saved, or imported. */
export type CsvImportState =
  | { step: 'invalid'; file: File | null; message: string }
  | { step: 'reading'; file: File }
  | ({ step: 'preview'; saveError?: string } & Previewed)
  /** The plan is frozen here: once saved, every word would read as a duplicate. */
  | ({ step: 'importing'; plan: CsvImportPlan } & Previewed)
  | { step: 'done'; file: File; added: number; duplicates: number; errors: number };

/**
 * The file picked via "Import CSV": its name and size, a preview of its
 * words with an Import button, then the result - or why it can't be used.
 * Presentational - Words owns the file picker, the state and the saving,
 * so every action is just emitted.
 */
@Component({
  selector: 'app-csv-file-panel',
  imports: [MatButtonModule, MatIconModule, CsvPreview],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './csv-file-panel.html',
  styleUrl: './csv-file-panel.scss',
})
export class CsvFilePanel {
  readonly state = input.required<CsvImportState>();
  /** Which previewed rows are new and which are duplicates (preview/importing only). */
  readonly plan = input<CsvImportPlan | null>(null);

  readonly chooseAnother = output<void>();
  readonly dismiss = output<void>();
  readonly importWords = output<void>();

  protected readonly file = computed(() => this.state().file);
  protected readonly size = computed(() => {
    const file = this.file();
    return file ? formatFileSize(file.size) : '';
  });

  /** "Skipped 2 duplicates and 1 row with errors." - or '' when nothing was. */
  protected readonly skipped = computed(() => {
    const s = this.state();
    if (s.step !== 'done') {
      return '';
    }
    const parts = [
      s.duplicates > 0 ? `${s.duplicates} ${s.duplicates === 1 ? 'duplicate' : 'duplicates'}` : '',
      s.errors > 0 ? `${s.errors} ${s.errors === 1 ? 'row' : 'rows'} with errors` : '',
    ].filter(Boolean);
    return parts.length > 0 ? `Skipped ${parts.join(' and ')}.` : '';
  });

  private readonly result = viewChild<ElementRef<HTMLElement>>('result');

  constructor() {
    // The Import button is gone once the words are saved: move focus to
    // the result, which also has it read out.
    effect(() => this.result()?.nativeElement.focus());
  }
}
