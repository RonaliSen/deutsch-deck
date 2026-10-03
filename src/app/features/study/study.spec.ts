import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DeutschDeckDb } from '../../core/data/db';
import { Word } from '../../core/models/word.model';
import { WordsStore } from '../../core/state/words.store';
import { Study } from './study';
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
    expect(fixture.nativeElement.querySelector('.flashcard-back .english').textContent).toContain(first.english);

    session.answer(true);
    fixture.detectChanges();

    const cardAfterAnswer = fixture.nativeElement.querySelector('.flashcard');
    // A new component instance - not the same node CSS-transitioning back -
    // so there's nothing to animate and nothing stale to leak.
    expect(cardAfterAnswer).not.toBe(cardBeforeAnswer);
    expect(cardAfterAnswer.classList.contains('flipped')).toBe(false);
    expect(fixture.nativeElement.querySelector('.flashcard-front .german').textContent).toContain(second.german);
    expect(fixture.nativeElement.querySelector('.flashcard-back .english').textContent).toContain(second.english);
    expect(fixture.nativeElement.querySelector('.flashcard-back .english').textContent).not.toContain(first.english);
  });
});
