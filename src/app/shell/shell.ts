import { BreakpointObserver } from '@angular/cdk/layout';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { map } from 'rxjs';
import { ThemeToggle } from '../shared/theme-toggle/theme-toggle';

const DESKTOP_QUERY = '(min-width: 768px)';

interface NavItem {
  path: string;
  label: string;
  icon: string;
}

const NAV_ITEMS: readonly NavItem[] = [
  { path: '/', label: 'Home', icon: 'home' },
  { path: '/study', label: 'Study', icon: 'school' },
  { path: '/quiz', label: 'Quiz', icon: 'quiz' },
  { path: '/words', label: 'Words', icon: 'menu_book' },
];

@Component({
  selector: 'app-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, MatIconModule, ThemeToggle],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './shell.html',
  styleUrl: './shell.scss',
})
export class Shell {
  protected readonly navItems = NAV_ITEMS;

  // No SSR, so reading matchMedia synchronously for the initial value is
  // safe and avoids a layout flash while the observable's first value lands.
  protected readonly isDesktop = toSignal(
    inject(BreakpointObserver)
      .observe(DESKTOP_QUERY)
      .pipe(map((state) => state.matches)),
    { initialValue: window.matchMedia(DESKTOP_QUERY).matches },
  );
}
