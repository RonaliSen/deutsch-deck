import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * White progress ring for the gradient banners (Study/Quiz results).
 * Decorative by design: callers show the same numbers as text elsewhere,
 * so the host is aria-hidden.
 */
@Component({
  selector: 'app-score-ring',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { 'aria-hidden': 'true', '[style.--pct]': 'percent()' },
  template: `
    <span class="value">{{ percent() }}%</span>
    <span class="label">{{ label() }}</span>
  `,
  styleUrl: './score-ring.scss',
})
export class ScoreRing {
  /** 0-100. */
  readonly percent = input.required<number>();
  /** Caption under the number, e.g. "known" or "correct". */
  readonly label = input.required<string>();
}
