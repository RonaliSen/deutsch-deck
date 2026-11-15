import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';

/** Row of four headline numbers: streak, mastered, deck size, recent accuracy. */
@Component({
  selector: 'app-stat-tiles',
  imports: [MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './stat-tiles.html',
  styleUrl: './stat-tiles.scss',
})
export class StatTiles {
  readonly streak = input.required<number>();
  readonly mastered = input.required<number>();
  readonly total = input.required<number>();
  readonly due = input.required<number>();
  /** Percent correct over the last sessions; null when there are none. */
  readonly accuracy = input.required<number | null>();
  /** How many sessions `accuracy` was measured over. */
  readonly sessionCount = input.required<number>();

  protected readonly masteredPercent = computed(() =>
    this.total() === 0 ? 0 : Math.round((this.mastered() / this.total()) * 100),
  );
}
