import { ChangeDetectionStrategy, Component } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { injectIsDesktop } from '../core/layout/breakpoints';
import { ThemeToggle } from '../shared/theme-toggle/theme-toggle';

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
  protected readonly isDesktop = injectIsDesktop();
}
