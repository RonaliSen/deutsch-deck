import { DatePipe, registerLocaleData } from '@angular/common';
import localeDe from '@angular/common/locales/de';
import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { Session } from '../../../core/models/session.model';

// See home-hero.ts - German dates on the dashboard only; idempotent.
registerLocaleData(localeDe);

/** Color bucket for a session's score pill. */
export type ScoreTone = 'great' | 'ok' | 'low';

export function scoreTone(percent: number): ScoreTone {
  if (percent >= 80) return 'great';
  if (percent >= 50) return 'ok';
  return 'low';
}

/** Latest study/quiz sessions with their score. */
@Component({
  selector: 'app-recent-activity',
  imports: [DatePipe, MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './recent-activity.html',
  styleUrl: './recent-activity.scss',
})
export class RecentActivity {
  /** Already sorted newest-first and capped (ProgressStore.lastSessions). */
  readonly sessions = input.required<Session[]>();

  protected readonly rows = computed(() =>
    this.sessions().map((session) => {
      const percent = session.total === 0 ? 0 : Math.round((session.correct / session.total) * 100);
      return { ...session, percent, tone: scoreTone(percent) };
    }),
  );
}
