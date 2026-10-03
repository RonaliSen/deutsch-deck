import { ChangeDetectionStrategy, Component, HostListener, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { isDue } from '../../core/utils/leitner';
import { LevelFilter, WordsStore } from '../../core/state/words.store';
import { Flashcard } from '../../shared/flashcard/flashcard';
import { StudySessionStore } from './study-session.store';

const LEVEL_CHIPS: readonly LevelFilter[] = ['all', 'A1', 'A2', 'B1'];

@Component({
  selector: 'app-study',
  providers: [StudySessionStore],
  imports: [
    RouterLink,
    MatButtonModule,
    MatChipsModule,
    MatFormFieldModule,
    MatProgressBarModule,
    MatSelectModule,
    Flashcard,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './study.html',
  styleUrl: './study.scss',
})
export class Study {
  protected readonly wordsStore = inject(WordsStore);
  protected readonly session = inject(StudySessionStore);

  protected readonly levelChips = LEVEL_CHIPS;
  protected readonly setupLevel = signal<LevelFilter>('all');
  protected readonly setupTopic = signal<string>('all');

  protected readonly topics = computed(() => Array.from(new Set(this.wordsStore.words().map((word) => word.topic))).sort());

  // Ignores the level/topic filters - used to tell "nothing due anywhere"
  // (the friendly empty state) apart from "nothing due under this filter".
  protected readonly globalDueCount = computed(() => this.wordsStore.words().filter((word) => isDue(word, Date.now())).length);

  protected readonly dueWords = computed(() => {
    const now = Date.now();
    const level = this.setupLevel();
    const topic = this.setupTopic();
    return this.wordsStore.words().filter((word) => {
      if (!isDue(word, now)) return false;
      if (level !== 'all' && word.level !== level) return false;
      if (topic !== 'all' && word.topic !== topic) return false;
      return true;
    });
  });

  protected readonly knownCount = computed(() => this.session.results().filter((r) => r.knewIt).length);
  protected readonly missedWords = computed(() => this.session.results().filter((r) => !r.knewIt).map((r) => r.word));

  protected readonly progressPercent = computed(() => {
    const { current, total } = this.session.progress();
    return total === 0 ? 0 : (current / total) * 100;
  });

  @HostListener('document:keydown', ['$event'])
  protected onKeydown(event: KeyboardEvent): void {
    if (this.session.status() !== 'studying') {
      return;
    }

    // The flashcard is a native <button>, so if it already has focus,
    // Space/Enter triggers its own click (-> flip) natively. Handling it
    // again here too would flip it twice (flip, then flip back).
    const targetIsCard = (event.target as HTMLElement | null)?.classList.contains('flashcard');
    if ((event.key === ' ' || event.key === 'Enter') && !targetIsCard) {
      event.preventDefault();
      this.session.flip();
      return;
    }

    if (!this.session.isFlipped()) {
      return;
    }
    if (event.key === '1') {
      this.session.answer(false);
    } else if (event.key === '2') {
      this.session.answer(true);
    }
  }

  protected setLevel(level: LevelFilter): void {
    this.setupLevel.set(level);
  }

  protected startSession(): void {
    this.session.start(this.dueWords());
  }

  protected studyAgain(): void {
    const words = this.dueWords();
    if (words.length === 0) {
      this.session.reset();
    } else {
      this.session.start(words);
    }
  }
}
