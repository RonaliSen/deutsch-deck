import { signal } from '@angular/core';
import {
  ComponentFixture,
  DeferBlockBehavior,
  DeferBlockState,
  TestBed,
} from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Session } from '../../core/models/session.model';
import { ProgressStore } from '../../core/state/progress.store';
import { WordsStore } from '../../core/state/words.store';
import { LevelStats } from '../../core/utils/progress';
import { Home } from './home';

const levels = (a1: LevelStats = { mastered: 17, total: 52, percent: 33 }) => ({
  A1: a1,
  A2: { mastered: 3, total: 18, percent: 17 },
  B1: { mastered: 0, total: 0, percent: 0 },
});

function fakeProgress() {
  return {
    totalWords: signal(70),
    masteredWords: signal(20),
    dueTodayCount: signal(12),
    streak: signal(4),
    levelProgress: signal(levels()),
    lastSessions: signal<Session[]>([]),
    recentAccuracy: signal<number | null>(null),
  };
}

describe('Home', () => {
  let fixture: ComponentFixture<Home>;
  let el: HTMLElement;
  let progress: ReturnType<typeof fakeProgress>;
  let loading: ReturnType<typeof signal<boolean>>;

  beforeEach(() => {
    progress = fakeProgress();
    loading = signal(false);
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: ProgressStore, useValue: progress },
        { provide: WordsStore, useValue: { loading } },
      ],
      // Recent activity is @defer (on viewport); jsdom has no
      // IntersectionObserver, so tests render it explicitly.
      deferBlockBehavior: DeferBlockBehavior.Manual,
    });
    fixture = TestBed.createComponent(Home);
    el = fixture.nativeElement;
  });

  const text = () => el.textContent!.replace(/\s+/g, ' ');
  const link = (label: string) =>
    Array.from(el.querySelectorAll('a'))
      .find((a) => a.textContent!.includes(label))
      ?.getAttribute('href');

  it('shows only the skeleton while words are loading', () => {
    loading.set(true);
    fixture.detectChanges();

    expect(el.querySelectorAll('.skeleton').length).toBeGreaterThan(0);
    expect(el.querySelector('h1')).toBeNull();
  });

  it('shows the first-run welcome when there are no words', () => {
    progress.totalWords.set(0);
    fixture.detectChanges();

    expect(el.querySelector('h1')!.textContent).toContain('Welcome to DeutschDeck!');
    expect(link('Go to Words')).toBe('/words');
    expect(el.querySelector('app-home-hero')).toBeNull();
  });

  it('leads with the due count and a Start studying link when words are due', () => {
    fixture.detectChanges();

    expect(text()).toContain('12 words due today');
    expect(link('Start studying')).toBe('/study');
    expect(link('Practise articles')).toBe('/quiz');
  });

  it('uses the singular for exactly one due word', () => {
    progress.dueTodayCount.set(1);
    fixture.detectChanges();

    expect(text()).toContain('1 word due today');
  });

  it('switches to "All caught up!" and the article quiz when nothing is due', () => {
    progress.dueTodayCount.set(0);
    fixture.detectChanges();

    expect(text()).toContain('All caught up!');
    expect(link('Start studying')).toBeUndefined();
    expect(el.querySelector('app-home-hero a')!.getAttribute('href')).toBe('/quiz');
  });

  it('shows the streak, or a nudge to start one', () => {
    fixture.detectChanges();
    expect(text()).toContain('4 days');

    progress.streak.set(0);
    fixture.detectChanges();
    expect(text()).toContain('Study today to start a streak');
  });

  it('shows mastered / total for every level, including empty ones', () => {
    fixture.detectChanges();
    const rows = Array.from(el.querySelectorAll('.level')).map((li) =>
      li.textContent!.replace(/\s+/g, ' '),
    );

    expect(rows).toHaveLength(3);
    expect(rows[0]).toContain('17 / 52 mastered');
    expect(rows[2]).toContain('0 / 0 mastered');
    expect(el.querySelectorAll('mat-progress-bar[aria-label="A1 progress"]').length).toBe(1);
  });

  it('shows a dash (with screen-reader text) for accuracy until there are sessions', () => {
    fixture.detectChanges();
    expect(text()).toContain('No data yet');

    progress.recentAccuracy.set(0);
    fixture.detectChanges();
    expect(text()).not.toContain('No data yet');
    expect(el.querySelector('app-stat-tiles')!.textContent).toMatch(/\b0\s*%/);
  });

  it('renders recent sessions with their score once the deferred block loads', async () => {
    progress.lastSessions.set([
      { id: 1, date: new Date(2026, 2, 15).getTime(), type: 'study', total: 20, correct: 17 },
      { id: 2, date: new Date(2026, 2, 14).getTime(), type: 'quiz', total: 10, correct: 3 },
    ]);
    fixture.detectChanges();
    const [activity] = await fixture.getDeferBlocks();
    await activity.render(DeferBlockState.Complete);

    const rows = Array.from(el.querySelectorAll('.activity')).map((li) =>
      li.textContent!.replace(/\s+/g, ' '),
    );
    expect(rows).toHaveLength(2);
    expect(rows[0]).toContain('17 / 20');
    expect(rows[0]).toContain('85%');
    expect(rows[0]).toContain('15. März');
    expect(el.querySelectorAll('.activity .pill--low').length).toBe(1);
  });

  it('says so when there are no sessions yet', async () => {
    fixture.detectChanges();
    const [activity] = await fixture.getDeferBlocks();
    await activity.render(DeferBlockState.Complete);

    expect(text()).toContain('No sessions yet.');
  });
});
