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
import { Gender } from '../../core/models/word.model';
import { LevelFilter, WordsStore } from '../../core/state/words.store';
import { isInteractiveTarget } from '../../core/utils/keyboard';
import { DEFAULT_COUNT, pickQuizWords } from '../../core/utils/quiz';
import { QuizFeedback } from './quiz-feedback/quiz-feedback';
import { QuizQuestion } from './quiz-question/quiz-question';
import { QuizResults } from './quiz-results/quiz-results';
import { QuizSessionStore } from './quiz-session.store';
import { QuizSetup } from './quiz-setup/quiz-setup';
const GENDER_OPTIONS: readonly Gender[] = ['der', 'die', 'das'];
const MIN_NOUNS = 4;

const GENDER_LABEL: Record<Gender, string> = {
  der: 'der (masculine)',
  die: 'die (feminine)',
  das: 'das (neuter)',
};

const GENDER_NAME: Record<Gender, string> = {
  der: 'masculine',
  die: 'feminine',
  das: 'neuter',
};

@Component({
  selector: 'app-quiz',
  providers: [QuizSessionStore],
  imports: [
    MatIconModule,
    MatProgressBarModule,
    QuizSetup,
    QuizQuestion,
    QuizFeedback,
    QuizResults,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './quiz.html',
  styleUrl: './quiz.scss',
})
export class Quiz {
  protected readonly wordsStore = inject(WordsStore);
  protected readonly session = inject(QuizSessionStore);

  protected readonly genderOptions = GENDER_OPTIONS;
  protected readonly genderLabel = GENDER_LABEL;
  protected readonly genderName = GENDER_NAME;
  protected readonly setupLevel = signal<LevelFilter>('all');
  protected readonly minNouns = MIN_NOUNS;

  // All nouns regardless of filter - tells "not enough words in the app at
  // all" (big friendly empty state) apart from "not enough at this level"
  // (small inline note, filters stay visible so the user can change them).
  protected readonly nouns = computed(() =>
    this.wordsStore.words().filter((word) => !!word.gender),
  );
  protected readonly globalNounCount = computed(() => this.nouns().length);

  protected readonly filteredNouns = computed(() => {
    const level = this.setupLevel();
    return this.nouns().filter((word) => level === 'all' || word.level === level);
  });

  // pickQuizWords caps a quiz at DEFAULT_COUNT questions.
  protected readonly questionCount = computed(() =>
    Math.min(this.filteredNouns().length, DEFAULT_COUNT),
  );

  protected readonly progressPercent = computed(() => {
    const { current, total } = this.session.progress();
    return total === 0 ? 0 : (current / total) * 100;
  });

  protected readonly isLastQuestion = computed(() => {
    const { current, total } = this.session.progress();
    return current === total;
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

    // A focused button or link handles its own Enter activation (e.g.
    // tabbing to "Next" and pressing Enter already calls next() via its own
    // click binding) - handling Enter globally too would fire it twice.
    if (
      event.key === 'Enter' &&
      !isInteractiveTarget(event.target) &&
      this.session.selectedAnswer() !== null
    ) {
      event.preventDefault();
      this.session.next();
    }
  }

  protected setLevel(level: LevelFilter): void {
    this.setupLevel.set(level);
  }

  protected readonly wrongAnswers = computed(() =>
    this.session.answers().filter((a) => !a.correct),
  );

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
