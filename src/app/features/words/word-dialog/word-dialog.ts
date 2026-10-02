import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { Gender, Level, Word, WordInput } from '../../../core/models/word.model';

export interface WordDialogData {
  word?: Word;
}

const LEVELS: readonly Level[] = ['A1', 'A2', 'B1'];
const GENDERS: readonly Gender[] = ['der', 'die', 'das'];
const TOPIC_SUGGESTIONS: readonly string[] = ['food', 'work', 'travel', 'home', 'family', 'other'];

@Component({
  selector: 'app-word-dialog',
  imports: [
    ReactiveFormsModule,
    MatAutocompleteModule,
    MatButtonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './word-dialog.html',
  styleUrl: './word-dialog.scss',
})
export class WordDialog {
  private readonly dialogRef = inject(MatDialogRef<WordDialog, WordInput>);
  private readonly data = inject<WordDialogData>(MAT_DIALOG_DATA, { optional: true }) ?? {};
  private readonly fb = inject(NonNullableFormBuilder);

  protected readonly isEdit = !!this.data.word;
  protected readonly levels = LEVELS;
  protected readonly genders = GENDERS;

  protected readonly filteredTopics = signal<readonly string[]>(TOPIC_SUGGESTIONS);

  protected readonly form = this.fb.group({
    german: this.fb.control(this.data.word?.german ?? '', Validators.required),
    gender: this.fb.control<Gender | ''>(this.data.word?.gender ?? ''),
    plural: this.fb.control(this.data.word?.plural ?? ''),
    english: this.fb.control(this.data.word?.english ?? '', Validators.required),
    level: this.fb.control<Level>(this.data.word?.level ?? 'A1', Validators.required),
    topic: this.fb.control(this.data.word?.topic ?? '', Validators.required),
  });

  protected onTopicInput(event: Event): void {
    const term = (event.target as HTMLInputElement).value.toLowerCase();
    this.filteredTopics.set(TOPIC_SUGGESTIONS.filter((topic) => topic.includes(term)));
  }

  protected save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const raw = this.form.getRawValue();
    const plural = raw.plural.trim();
    const result: WordInput = {
      german: raw.german.trim(),
      english: raw.english.trim(),
      level: raw.level,
      topic: raw.topic.trim(),
      ...(raw.gender ? { gender: raw.gender } : {}),
      ...(plural ? { plural } : {}),
    };
    this.dialogRef.close(result);
  }

  protected cancel(): void {
    this.dialogRef.close();
  }
}
