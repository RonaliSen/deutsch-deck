/**
 * True when a key event's target is a control that already handles
 * Space/Enter natively (buttons, links, listbox options, form fields).
 * Page-level shortcuts check this so they don't double-handle a key the
 * focused control is about to turn into its own click.
 */
export function isInteractiveTarget(target: EventTarget | null): boolean {
  return (
    target instanceof Element &&
    !!target.closest('button, a[href], [role="option"], input, select, textarea')
  );
}
