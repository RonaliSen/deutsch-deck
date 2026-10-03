import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
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

// No MatTooltipModule: it pulled ~17KB gzip of CDK Overlay machinery into
// the eager bundle (ThemeToggle lives in Shell, loaded on every page) for a
// hover hint that duplicated this same text - the aria-label alone covers
// both sighted and assistive-tech users.
@Component({
  selector: 'app-theme-toggle',
  imports: [MatButtonModule, MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button type="button" mat-icon-button [attr.aria-label]="ariaLabel()" (click)="themeStore.cycle()">
      <mat-icon>{{ icon() }}</mat-icon>
    </button>
  `,
})
export class ThemeToggle {
  protected readonly themeStore = inject(ThemeStore);

  protected readonly icon = computed(() => ICON_BY_MODE[this.themeStore.mode()]);
  protected readonly ariaLabel = computed(() => `Theme: ${LABEL_BY_MODE[this.themeStore.mode()]} (click to change)`);
}
