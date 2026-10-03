import { ChangeDetectionStrategy, Component, HostListener, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { Gender } from '../../core/models/word.model';
import { LevelFilter, WordsStore } from '../../core/state/words.store';
import { pickQuizWords } from '../../core/utils/quiz';
import { ArticleBadge } from '../../shared/article-badge/article-badge';
import { QuizSessionStore } from './quiz-session.store';

const LEVEL_CHIPS: readonly LevelFilter[] = ['all', 'A1', 'A2', 'B1'];
const GENDER_OPTIONS: readonly Gender[] = ['der', 'die', 'das'];
const MIN_NOUNS = 4;

const GENDER_LABEL: Record<Gender, string> = {
  der: 'der (masculine)',
  die: 'die (feminine)',
  das: 'das (neuter)',
};

@Component({
  selector: 'app-quiz',
  providers: [QuizSessionStore],
  imports: [RouterLink, MatButtonModule, MatChipsModule, MatIconModule, MatProgressBarModule, ArticleBadge],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './quiz.html',
  styleUrl: './quiz.scss',
})
export class Quiz {
  protected readonly wordsStore = inject(WordsStore);
  protected readonly session = inject(QuizSessionStore);

  protected readonly levelChips = LEVEL_CHIPS;
  protected readonly genderOptions = GENDER_OPTIONS;
  protected readonly genderLabel = GENDER_LABEL;
  protected readonly setupLevel = signal<LevelFilter>('all');
  protected readonly minNouns = MIN_NOUNS;

  // All nouns regardless of filter - tells "not enough words in the app at
  // all" (big friendly empty state) apart from "not enough at this level"
  // (small inline note, filters stay visible so the user can change them).
  protected readonly nouns = computed(() => this.wordsStore.words().filter((word) => !!word.gender));
  protected readonly globalNounCount = computed(() => this.nouns().length);

  protected readonly filteredNouns = computed(() => {
    const level = this.setupLevel();
    return this.nouns().filter((word) => level === 'all' || word.level === level);
  });

  protected readonly liveText = computed(() => {
    const selected = this.session.selectedAnswer();
    const question = this.session.currentQuestion();
    if (selected === null || !question) {
      return '';
    }
    const plural = question.plural ? `, plural ${question.plural}` : '';
    if (selected === question.gender) {
      return `Correct! It's ${question.gender} ${question.german}${plural}.`;
    }
    return `Incorrect. It's ${question.gender} ${question.german}${plural}.`;
  });

  @HostListener('document:keydown', ['$event'])
  protected onKeydown(event: KeyboardEvent): void {
    if (this.session.status() !== 'playing') {
      return;
    }

    if (event.key === '1' || event.key === '2' || event.key === '3') {
      this.session.selectAnswer(GENDER_OPTIONS[Number(event.key) - 1]);
      return;
    }

    // Native <button>s handle their own Enter activation (e.g. tabbing to
    // "Next" and pressing Enter already calls next() via its own click
    // binding) - handling Enter globally too would fire it twice.
    const targetIsButton = (event.target as HTMLElement | null)?.tagName === 'BUTTON';
    if (event.key === 'Enter' && !targetIsButton && this.session.selectedAnswer() !== null) {
      event.preventDefault();
      this.session.next();
    }
  }

  protected setLevel(level: LevelFilter): void {
    this.setupLevel.set(level);
  }

  protected readonly wrongAnswers = computed(() => this.session.answers().filter((a) => !a.correct));

  protected readonly resultMessage = computed(() => {
    const total = this.session.questions().length;
    if (total === 0) {
      return '';
    }
    const ratio = this.session.score() / total;
    if (ratio === 1) return 'Perfect!';
    if (ratio >= 0.8) return 'Great job!';
    if (ratio >= 0.5) return 'Good effort!';
    return 'Keep practicing!';
  });

  protected answerClass(gender: Gender): string {
    const selected = this.session.selectedAnswer();
    const question = this.session.currentQuestion();
    if (selected === null || !question) {
      return '';
    }
    if (gender === selected) {
      return selected === question.gender ? 'correct' : 'wrong';
    }
    return gender === question.gender ? 'reveal' : 'dim';
  }

  protected startQuiz(): void {
    this.session.start(pickQuizWords(this.filteredNouns()));
  }

  protected playAgain(): void {
    const pool = this.filteredNouns();
    if (pool.length < MIN_NOUNS) {
      this.session.reset();
    } else {
      this.session.start(pickQuizWords(pool));
    }
  }
}
