import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ThemeMode, ThemeStore } from '../../core/state/theme.store';

const ICON_BY_MODE: Record<ThemeMode, string> = {
  system: 'brightness_auto',
  light: 'light_mode',
  dark: 'dark_mode',
};

const LABEL_BY_MODE: Record<ThemeMode, string> = {
  system: 'System',
  light: 'Light',
  dark: 'Dark',
};

@Component({
  selector: 'app-theme-toggle',
  imports: [MatButtonModule, MatIconModule, MatTooltipModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button
      type="button"
      mat-icon-button
      [matTooltip]="label()"
      [attr.aria-label]="label()"
      (click)="themeStore.cycle()"
    >
      <mat-icon>{{ icon() }}</mat-icon>
    </button>
  `,
})
export class ThemeToggle {
  protected readonly themeStore = inject(ThemeStore);

  protected readonly icon = computed(() => ICON_BY_MODE[this.themeStore.mode()]);
  protected readonly label = computed(() => `Theme: ${LABEL_BY_MODE[this.themeStore.mode()]}`);
}
