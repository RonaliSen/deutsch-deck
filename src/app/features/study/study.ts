import {
  ChangeDetectionStrategy,
  Component,
  HostListener,
  computed,
  inject,
  signal,
} from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { isInteractiveTarget } from '../../core/utils/keyboard';
import { isDue, review } from '../../core/utils/leitner';
import { LevelFilter, WordsStore } from '../../core/state/words.store';
import { Flashcard } from '../../shared/flashcard/flashcard';
import { SESSION_SIZE, StudySessionStore } from './study-session.store';
import { StudySetup } from './study-setup/study-setup';
import { StudySummary } from './study-summary/study-summary';

/** "Moves to box 3" / "Back to box 1" / "Stays in box 5" for a rating button. */
export function boxOutcome(fromBox: number, toBox: number): string {
  if (toBox === fromBox) return `Stays in box ${toBox}`;
  return toBox > fromBox ? `Moves to box ${toBox}` : `Back to box ${toBox}`;
}

@Component({
  selector: 'app-study',
  providers: [StudySessionStore],
  imports: [MatIconModule, MatProgressBarModule, Flashcard, StudySetup, StudySummary],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './study.html',
  styleUrl: './study.scss',
})
export class Study {
  protected readonly wordsStore = inject(WordsStore);
  protected readonly session = inject(StudySessionStore);

  protected readonly setupLevel = signal<LevelFilter>('all');
  protected readonly setupTopic = signal<string>('all');

  protected readonly topics = computed(() =>
    Array.from(new Set(this.wordsStore.words().map((word) => word.topic))).sort(),
  );

  // Ignores the level/topic filters - used to tell "nothing due anywhere"
  // (the friendly empty state) apart from "nothing due under this filter".
  protected readonly globalDueCount = computed(
    () => this.wordsStore.words().filter((word) => isDue(word, Date.now())).length,
  );

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

  protected readonly sessionSize = computed(() => Math.min(this.dueWords().length, SESSION_SIZE));

  protected readonly knownCount = computed(
    () => this.session.results().filter((r) => r.knewIt).length,
  );
  protected readonly missedWords = computed(() =>
    this.session
      .results()
      .filter((r) => !r.knewIt)
      .map((r) => r.word),
  );

  // What each rating button will do to the current card's Leitner box -
  // computed with the real review() rule, so the label can't drift from it.
  protected readonly knownOutcome = computed(() => this.outcome(true));
  protected readonly missedOutcome = computed(() => this.outcome(false));

  protected readonly progressPercent = computed(() => {
    const { current, total } = this.session.progress();
    return total === 0 ? 0 : (current / total) * 100;
  });

  @HostListener('document:keydown', ['$event'])
  protected onKeydown(event: KeyboardEvent): void {
    if (this.session.status() !== 'studying') {
      return;
    }

    // A focused button or link (the flashcard itself, Show answer, the
    // rating buttons, ...) already turns Space/Enter into its own click
    // natively. Handling the key here too would either double-flip the
    // card or flip it instead of activating the focused rating button.
    if ((event.key === ' ' || event.key === 'Enter') && !isInteractiveTarget(event.target)) {
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

  private outcome(knewIt: boolean): string {
    const card = this.session.currentCard();
    return card ? boxOutcome(card.box, review(card, knewIt, Date.now()).box) : '';
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
