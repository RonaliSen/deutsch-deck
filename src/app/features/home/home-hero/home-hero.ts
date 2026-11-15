import { DatePipe, registerLocaleData } from '@angular/common';
import localeDe from '@angular/common/locales/de';
import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink } from '@angular/router';

// Registered here (not globally in app.config.ts) because only the Home
// dashboard needs German date formatting - the app's own UI stays English
// (LOCALE_ID is untouched), 'de' is only ever passed explicitly to the date
// pipe. Idempotent, so RecentActivity registering it too is harmless.
registerLocaleData(localeDe);

/** Gradient banner at the top of Home: greeting, date, and today's main call to action. */
@Component({
  selector: 'app-home-hero',
  imports: [DatePipe, RouterLink, MatButtonModule, MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './home-hero.html',
  styleUrl: './home-hero.scss',
})
export class HomeHero {
  readonly greeting = input.required<string>();
  readonly today = input.required<Date>();
  readonly dueCount = input.required<number>();
}
