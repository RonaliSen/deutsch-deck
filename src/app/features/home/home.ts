import { DatePipe, registerLocaleData } from '@angular/common';
import localeDe from '@angular/common/locales/de';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { Level } from '../../core/models/word.model';
import { ProgressStore } from '../../core/state/progress.store';
import { WordsStore } from '../../core/state/words.store';
import { greetingFor } from '../../core/utils/progress';

// Registered here (not globally in app.config.ts) because this is the only
// page that needs German date formatting - the app's own UI stays English
// (LOCALE_ID is untouched), 'de' is only ever passed explicitly to the
// date pipe below.
registerLocaleData(localeDe);

const LEVELS: readonly Level[] = ['A1', 'A2', 'B1'];

@Component({
  selector: 'app-home',
  imports: [DatePipe, RouterLink, MatButtonModule, MatIconModule, MatProgressBarModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './home.html',
  styleUrl: './home.scss',
})
export class Home {
  protected readonly wordsStore = inject(WordsStore);
  protected readonly progress = inject(ProgressStore);

  protected readonly levels = LEVELS;
  protected readonly today = new Date();
  protected readonly greeting = greetingFor(this.today);
}
