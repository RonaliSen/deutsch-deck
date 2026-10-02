import { computed, effect } from '@angular/core';
import { patchState, signalStore, withComputed, withHooks, withMethods, withState } from '@ngrx/signals';

export type ThemeMode = 'system' | 'light' | 'dark';

const STORAGE_KEY = 'deutschdeck-theme-mode';

function loadStoredMode(): ThemeMode {
  const stored = localStorage.getItem(STORAGE_KEY);
  return stored === 'light' || stored === 'dark' || stored === 'system' ? stored : 'system';
}

function systemPrefersDark(): boolean {
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

const NEXT_MODE: Record<ThemeMode, ThemeMode> = {
  system: 'light',
  light: 'dark',
  dark: 'system',
};

export const ThemeStore = signalStore(
  { providedIn: 'root' },
  withState<{ mode: ThemeMode; systemPrefersDark: boolean }>(() => ({
    mode: loadStoredMode(),
    systemPrefersDark: systemPrefersDark(),
  })),
  withComputed(({ mode, systemPrefersDark }) => ({
    // The mode actually applied to the page: 'system' resolves to whatever
    // the OS currently prefers.
    resolvedMode: computed(() => (mode() === 'system' ? (systemPrefersDark() ? 'dark' : 'light') : mode())),
  })),
  withMethods((store) => ({
    setMode(mode: ThemeMode): void {
      patchState(store, { mode });
      localStorage.setItem(STORAGE_KEY, mode);
    },
    cycle(): void {
      this.setMode(NEXT_MODE[store.mode()]);
    },
  })),
  withHooks({
    onInit(store) {
      // Keep <html> in sync with the resolved mode.
      effect(() => {
        const resolved = store.resolvedMode();
        document.documentElement.setAttribute('data-theme', resolved);
        document.documentElement.style.colorScheme = resolved;
      });

      // Mode 'system' should track OS changes live, not just at page load.
      window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (event) => {
        patchState(store, { systemPrefersDark: event.matches });
      });
    },
  }),
);
