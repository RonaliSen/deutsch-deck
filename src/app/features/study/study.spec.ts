import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DeutschDeckDb } from '../../core/data/db';
import { Word } from '../../core/models/word.model';
import { WordsStore } from '../../core/state/words.store';
import { provideRouter } from '@angular/router';
import { boxOutcome, Study } from './study';
import { StudySessionStore } from './study-session.store';

function word(id: number, overrides: Partial<Word> = {}): Word {
  return {
    id,
    german: `Wort${id}`,
    english: `word${id}`,
    level: 'A1',
    topic: 'Allgemein',
    box: 1,
    dueAt: 0,
    createdAt: 0,
    ...overrides,
  };
}

describe('Study', () => {
  let fixture: ComponentFixture<Study>;
  let session: InstanceType<typeof StudySessionStore>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: WordsStore, useValue: { words: signal<Word[]>([]), reviewWord: vi.fn() } },
        { provide: DeutschDeckDb, useValue: { sessions: { add: vi.fn().mockResolvedValue(1) } } },
      ],
    });
    fixture = TestBed.createComponent(Study);
    session = fixture.debugElement.injector.get(StudySessionStore);
  });

  // Regression test: answer() swaps currentCard and resets isFlipped in the
  // same patchState. Without keying app-flashcard by word id, Angular reused
  // the old <app-flashcard> instance and CSS-transitioned it from flipped to
  // unflipped - which meant it briefly rendered the *new* word's back-side
  // content (its answer) while still mid flip-back from the old card.
  it('shows a fresh, unflipped card for the next word after answering', () => {
    session.start([word(1), word(2)]);
    // start() shuffles, so read the actual order rather than assuming it.
    const [first, second] = session.queue();
    fixture.detectChanges();

    session.flip();
    fixture.detectChanges();
    const cardBeforeAnswer = fixture.nativeElement.querySelector('.flashcard');
    expect(cardBeforeAnswer.classList.contains('flipped')).toBe(true);
    expect(fixture.nativeElement.querySelector('.flashcard-back .english').textContent).toContain(
      first.english,
    );

    session.answer(true);
    fixture.detectChanges();

    const cardAfterAnswer = fixture.nativeElement.querySelector('.flashcard');
    // A new component instance - not the same node CSS-transitioning back -
    // so there's nothing to animate and nothing stale to leak.
    expect(cardAfterAnswer).not.toBe(cardBeforeAnswer);
    expect(cardAfterAnswer.classList.contains('flipped')).toBe(false);
    expect(fixture.nativeElement.querySelector('.flashcard-front .german').textContent).toContain(
      second.german,
    );
    expect(fixture.nativeElement.querySelector('.flashcard-back .english').textContent).toContain(
      second.english,
    );
    expect(
      fixture.nativeElement.querySelector('.flashcard-back .english').textContent,
    ).not.toContain(first.english);
  });
});

describe('Study (redesigned controls)', () => {
  let fixture: ComponentFixture<Study>;
  let el: HTMLElement;
  let session: InstanceType<typeof StudySessionStore>;
  let words: ReturnType<typeof signal<Word[]>>;
  let reviewWord: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    words = signal<Word[]>([]);
    reviewWord = vi.fn();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: WordsStore, useValue: { words, reviewWord } },
        { provide: DeutschDeckDb, useValue: { sessions: { add: vi.fn().mockResolvedValue(1) } } },
      ],
    });
    fixture = TestBed.createComponent(Study);
    el = fixture.nativeElement;
    session = fixture.debugElement.injector.get(StudySessionStore);
  });

  const text = () => el.textContent!.replace(/\s+/g, ' ');
  const button = (label: string) =>
    Array.from(el.querySelectorAll('button')).find((b) => b.textContent!.includes(label));
  const press = (key: string, target: EventTarget = document.body) =>
    target.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));

  describe('setup', () => {
    it('shows the friendly empty state when nothing is due anywhere', () => {
      words.set([word(1, { dueAt: Date.now() + 86_400_000 })]);
      fixture.detectChanges();

      expect(text()).toContain('All done for today! Come back tomorrow.');
      expect(button('Start session')).toBeUndefined();
    });

    it('shows due and session counts, and starts a session capped at 20', () => {
      words.set(Array.from({ length: 25 }, (_, i) => word(i + 1)));
      fixture.detectChanges();

      const counts = Array.from(el.querySelectorAll('.counts > div')).map((pair) => [
        pair.querySelector('dt')!.textContent!.trim(),
        pair.querySelector('dd')!.textContent!.trim(),
      ]);
      expect(counts).toEqual([
        ['Words due', '25'],
        ['This session', '20'],
      ]);
      button('Start session (20)')!.click();
      fixture.detectChanges();

      expect(session.status()).toBe('studying');
      expect(session.queue()).toHaveLength(20);
    });

    it('disables Start and explains why when the filters match nothing due', () => {
      words.set([word(1, { level: 'A1' })]);
      fixture.detectChanges();
      const b1 = Array.from(el.querySelectorAll('mat-chip-option')).find((c) =>
        c.textContent!.includes('B1'),
      );
      (b1 as HTMLElement).click();
      fixture.detectChanges();

      expect(button('Start session')!.disabled).toBe(true);
      expect(text()).toContain('No due words match these filters.');
    });
  });

  describe('studying', () => {
    beforeEach(() => {
      session.start([word(1, { box: 2 })]);
      fixture.detectChanges();
    });

    it('offers Show answer before the flip, and the rating buttons only after it', () => {
      expect(button("Didn't know")).toBeUndefined();

      button('Show answer')!.click();
      fixture.detectChanges();

      expect(session.isFlipped()).toBe(true);
      expect(button('Show answer')).toBeUndefined();
      expect(button("Didn't know")).toBeDefined();
      expect(button('Knew it')).toBeDefined();
    });

    it("labels each rating with what it does to the card's box", () => {
      session.flip();
      fixture.detectChanges();

      expect(button('Knew it')!.textContent).toContain('Moves to box 3');
      expect(button("Didn't know")!.textContent).toContain('Back to box 1');
    });

    it('records the answer from a rating button click', () => {
      session.flip();
      fixture.detectChanges();
      button('Knew it')!.click();

      expect(reviewWord).toHaveBeenCalledWith(1, true);
      expect(session.results()).toEqual([
        { word: expect.objectContaining({ id: 1 }), knewIt: true },
      ]);
    });

    it('flips on Space/Enter anywhere that is not itself a button', () => {
      press(' ');
      expect(session.isFlipped()).toBe(true);
      press('Enter');
      expect(session.isFlipped()).toBe(false);
    });

    it('leaves Space/Enter on a focused button to that button (no extra flip)', () => {
      session.flip();
      fixture.detectChanges();
      const knewIt = button('Knew it')!;

      const notCancelled = press('Enter', knewIt);

      // The global handler stayed out of it: the card is still flipped and
      // the event was not cancelled, so the button's own click goes ahead.
      expect(notCancelled).toBe(true);
      expect(session.isFlipped()).toBe(true);
    });

    it('answers with 1 / 2 only once the card is flipped', () => {
      press('2');
      expect(reviewWord).not.toHaveBeenCalled();

      session.flip();
      press('1');
      expect(reviewWord).toHaveBeenCalledWith(1, false);
    });
  });

  describe('done', () => {
    it('summarises the session and lists missed words', () => {
      session.start([word(1), word(2)]);
      const [first, second] = session.queue();
      session.answer(true);
      session.answer(false);
      fixture.detectChanges();

      expect(el.querySelector('h1')!.textContent).toContain('Session complete');
      expect(text()).toContain('1 known, 1 not known');
      const missed = Array.from(el.querySelectorAll('.missed-list li')).map((li) => li.textContent);
      expect(missed).toHaveLength(1);
      expect(missed[0]).toContain(second.german);
      expect(missed[0]).not.toContain(first.german);
    });
  });
});

describe('boxOutcome', () => {
  it('describes moving up, dropping back and staying put', () => {
    expect(boxOutcome(2, 3)).toBe('Moves to box 3');
    expect(boxOutcome(4, 1)).toBe('Back to box 1');
    expect(boxOutcome(1, 1)).toBe('Stays in box 1');
    expect(boxOutcome(5, 5)).toBe('Stays in box 5');
  });
});
