import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { Gender, Word } from '../../../core/models/word.model';

// Same article color coding as the badges and flashcards.
const GENDER_TONE: Record<Gender, string> = {
  der: 'blue',
  die: 'red',
  das: 'green',
};

/**
 * The noun being asked about, with a blank for its article. Neutral until
 * answered; then the blank fills in and the card takes the right article's
 * color - never before, so the color can't give the answer away.
 */
@Component({
  selector: 'app-quiz-question',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './quiz-question.html',
  styleUrl: './quiz-question.scss',
})
export class QuizQuestion {
  readonly word = input.required<Word>();
  readonly answered = input.required<boolean>();

  protected readonly tone = computed(() =>
    this.answered() && this.word().gender ? GENDER_TONE[this.word().gender!] : 'orange',
  );
}
