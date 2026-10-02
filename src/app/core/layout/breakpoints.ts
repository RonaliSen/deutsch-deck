import { BreakpointObserver } from '@angular/cdk/layout';
import { inject, Signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';

export const DESKTOP_QUERY = '(min-width: 768px)';

/** Signal that's true at/above the desktop breakpoint (768px). */
export function injectIsDesktop(): Signal<boolean> {
  return toSignal(
    inject(BreakpointObserver)
      .observe(DESKTOP_QUERY)
      .pipe(map((state) => state.matches)),
    // No SSR, so reading matchMedia synchronously for the initial value is
    // safe and avoids a layout flash while the observable's first value lands.
    { initialValue: window.matchMedia(DESKTOP_QUERY).matches },
  );
}
