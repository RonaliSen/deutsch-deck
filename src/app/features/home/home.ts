import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { ProgressStore } from '../../core/state/progress.store';
import { WordsStore } from '../../core/state/words.store';
import { greetingFor } from '../../core/utils/progress';
import { HomeHero } from './home-hero/home-hero';
import { LevelProgress } from './level-progress/level-progress';
import { RecentActivity } from './recent-activity/recent-activity';
import { StatTiles } from './stat-tiles/stat-tiles';

/**
 * Dashboard page. Reads the stores and lays out the panels; each panel is
 * a presentational child component that only takes inputs (and carries its
 * own styles, keeping every stylesheet inside the per-component budget).
 */
@Component({
  selector: 'app-home',
  imports: [
    RouterLink,
    MatButtonModule,
    MatIconModule,
    HomeHero,
    StatTiles,
    LevelProgress,
    RecentActivity,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './home.html',
  styleUrl: './home.scss',
})
export class Home {
  protected readonly wordsStore = inject(WordsStore);
  protected readonly progress = inject(ProgressStore);

  protected readonly today = new Date();
  protected readonly greeting = greetingFor(this.today);
}
