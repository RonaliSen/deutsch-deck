import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { DeutschDeckDb } from '../../core/data/db';
import { Gender, Level, Word } from '../../core/models/word.model';
import { WordsStore } from '../../core/state/words.store';
import { Quiz } from './quiz';
import { QuizSessionStore } from './quiz-session.store';

function noun(id: number, gender: Gender | undefined, level: Level = 'A1'): Word {
  return {
    id,
    german: `Wort${id}`,
    english: `word${id}`,
    gender,
    plural: gender ? `Wörter${id}` : undefined,
    level,
    topic: 'Allgemein',
    box: 1,
    dueAt: 0,
    createdAt: 0,
  };
}

const GENDERS: Gender[] = ['der', 'die', 'das'];

describe('Quiz', () => {
  let fixture: ComponentFixture<Quiz>;
  let el: HTMLElement;
  let session: InstanceType<typeof QuizSessionStore>;
  let words: ReturnType<typeof signal<Word[]>>;
  let addSession: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    words = signal<Word[]>([]);
    addSession = vi.fn().mockResolvedValue(1);
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: WordsStore, useValue: { words } },
        { provide: DeutschDeckDb, useValue: { sessions: { add: addSession } } },
      ],
    });
    fixture = TestBed.createComponent(Quiz);
    el = fixture.nativeElement;
    session = fixture.debugElement.injector.get(QuizSessionStore);
  });

  const text = () => el.textContent!.replace(/\s+/g, ' ');
  const button = (label: string) =>
    Array.from(el.querySelectorAll('button')).find((b) => b.textContent!.includes(label));
  const answerButton = (gender: Gender) =>
    el.querySelector<HTMLButtonElement>(`.answer[data-gender="${gender}"]`)!;
  const press = (key: string, target: EventTarget = document.body) =>
    target.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
  const wrongFor = (gender: Gender) => GENDERS.find((g) => g !== gender)!;

  function startWith(list: Word[]): void {
    words.set(list);
    fixture.detectChanges();
    button('Start quiz')!.click();
    fixture.detectChanges();
  }

  describe('setup', () => {
    it('asks for more words when there are fewer than 4 nouns in total', () => {
      // Words without an article don't count as quiz nouns.
      words.set([noun(1, 'der'), noun(2, 'die'), noun(3, 'das'), noun(4, undefined)]);
      fixture.detectChanges();

      expect(text()).toContain('You need at least 4 nouns with an article to quiz.');
      expect(button('Start quiz')).toBeUndefined();
    });

    it('shows nouns available and a question count capped at 10', () => {
      words.set(Array.from({ length: 12 }, (_, i) => noun(i + 1, GENDERS[i % 3])));
      fixture.detectChanges();

      const counts = Array.from(el.querySelectorAll('.counts > div')).map((pair) => [
        pair.querySelector('dt')!.textContent!.trim(),
        pair.querySelector('dd')!.textContent!.trim(),
      ]);
      expect(counts).toEqual([
        ['Nouns available', '12'],
        ['Questions', '10'],
      ]);
    });

    it('disables Start when the selected level has too few nouns', () => {
      words.set([...Array.from({ length: 4 }, (_, i) => noun(i + 1, 'der')), noun(9, 'die', 'B1')]);
      fixture.detectChanges();
      const b1 = Array.from(el.querySelectorAll('mat-chip-option')).find((c) =>
        c.textContent!.includes('B1'),
      );
      (b1 as HTMLElement).click();
      fixture.detectChanges();

      expect(button('Start quiz')!.disabled).toBe(true);
      expect(text()).toContain('Not enough nouns at this level (need at least 4).');
    });

    it('starts a quiz with only nouns from the pool', () => {
      startWith([
        noun(1, 'der'),
        noun(2, 'die'),
        noun(3, 'das'),
        noun(4, 'der'),
        noun(5, undefined),
      ]);

      expect(session.status()).toBe('playing');
      expect(session.questions()).toHaveLength(4);
      expect(session.questions().every((w) => !!w.gender)).toBe(true);
      expect(text()).toContain('Question 1 of 4');
    });
  });

  describe('answering', () => {
    beforeEach(() => startWith([noun(1, 'der'), noun(2, 'die'), noun(3, 'das'), noun(4, 'der')]));

    it('hides the article until answered, then fills it in', () => {
      const question = session.currentQuestion()!;
      const heading = () => el.querySelector('h2.noun')!.textContent!.trim();
      expect(heading()).toBe(question.german);

      answerButton(question.gender!).click();
      fixture.detectChanges();

      expect(heading().replace(/\s+/g, ' ')).toBe(`${question.gender} ${question.german}`);
    });

    it('marks a right answer and shows "Correct!" feedback', () => {
      const question = session.currentQuestion()!;
      answerButton(question.gender!).click();
      fixture.detectChanges();

      expect(answerButton(question.gender!).classList).toContain('correct');
      expect(el.querySelector('.feedback')!.textContent).toContain('Correct!');
      expect(el.querySelector('[aria-live]')!.textContent).toContain(
        `Correct! It's ${question.gender}`,
      );
    });

    it('marks a wrong answer, reveals the right one and shows the full noun', () => {
      const question = session.currentQuestion()!;
      const wrong = wrongFor(question.gender!);
      answerButton(wrong).click();
      fixture.detectChanges();

      expect(answerButton(wrong).classList).toContain('wrong');
      expect(answerButton(question.gender!).classList).toContain('reveal');
      const feedback = el.querySelector('.feedback')!.textContent!;
      expect(feedback).toContain('Not quite');
      expect(feedback).toContain(question.german);
      expect(feedback).toContain(question.plural!);
    });

    it('locks the answer buttons after the first pick', () => {
      answerButton('der').click();
      fixture.detectChanges();

      expect(GENDERS.every((g) => answerButton(g).disabled)).toBe(true);
      expect(session.answers()).toHaveLength(1);
    });

    it('answers with keys 1 / 2 / 3 (der / die / das)', () => {
      press('2');
      expect(session.answers()[0].chosen).toBe('die');
    });

    it('goes to the next question with Enter, but only once answered', () => {
      press('Enter');
      expect(session.currentIndex()).toBe(0);

      press('1');
      press('Enter');
      expect(session.currentIndex()).toBe(1);
    });

    it('leaves Enter on a focused button to that button', () => {
      press('1');
      fixture.detectChanges();

      const notCancelled = press('Enter', button('Next question')!);

      expect(notCancelled).toBe(true);
      expect(session.currentIndex()).toBe(0);
    });

    it('labels the last Next button "See results"', () => {
      for (let i = 0; i < 3; i++) {
        press('1');
        press('Enter');
      }
      press('1');
      fixture.detectChanges();

      expect(button('See results')).toBeDefined();
      expect(button('Next question')).toBeUndefined();
    });
  });

  describe('results', () => {
    function finish(rightOnFirst: boolean): void {
      session.questions().forEach((q, i) => {
        const right = i > 0 || rightOnFirst;
        session.selectAnswer(right ? q.gender! : wrongFor(q.gender!));
        session.next();
      });
      fixture.detectChanges();
    }

    beforeEach(() => startWith([noun(1, 'der'), noun(2, 'die'), noun(3, 'das'), noun(4, 'der')]));

    it('shows score, message and each wrong answer', () => {
      const first = session.questions()[0];
      finish(false);

      expect(el.querySelector('h1')!.textContent).toContain('Quiz complete');
      expect(text()).toContain('3 / 4');
      expect(text()).toContain('Good effort!');
      const rows = Array.from(el.querySelectorAll('.wrong-list li')).map((li) =>
        li.textContent!.replace(/\s+/g, ' '),
      );
      expect(rows).toHaveLength(1);
      expect(rows[0]).toContain(first.german);
      expect(rows[0]).toContain(`you said ${wrongFor(first.gender!)}, correct: ${first.gender}`);
      expect(addSession).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'quiz', total: 4, correct: 3 }),
      );
    });

    it('celebrates a perfect round instead of listing nothing', () => {
      finish(true);

      expect(text()).toContain('Perfect!');
      expect(text()).toContain('You got every article right.');
      expect(el.querySelector('.wrong-list')).toBeNull();
    });

    it('Play again starts a fresh quiz from the same pool', () => {
      finish(true);
      button('Play again')!.click();
      fixture.detectChanges();

      expect(session.status()).toBe('playing');
      expect(session.answers()).toHaveLength(0);
    });
  });
});
