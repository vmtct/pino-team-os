type Focusable = { focus(): void };
/** PAP-1821 / PLT-ATTR: keep ownership of the ORIGINAL key event after React
 * synchronously unmounts the popover before the outer document listener runs.
 * Reading the live DOM alone can falsely classify this Escape as a Drawer key.
 */
export function editorOwnsDialogKey(event: Pick<KeyboardEvent, "target" | "composedPath">): boolean {
  const selector = ".edit-popover:not(.hidden)";
  const target = event.target as Element | null;
  if (typeof target?.closest === "function" && target.closest(selector)) return true;
  return event.composedPath().some(node => {
    const element = node as Element;
    return typeof element?.matches === "function" && element.matches(selector);
  });
}
/** Pure event policy shared by the existing DOM lifecycle and focused contract tests. */
export function handleDialogKey(event: { readonly key: string; readonly shiftKey: boolean; preventDefault(): void }, state: {
  readonly editorOpen: boolean; readonly first?: Focusable; readonly last?: Focusable;
  readonly active: unknown; readonly containsActive: boolean; readonly close: () => void;
}) {
  if (state.editorOpen) return;
  if (event.key === "Escape") { event.preventDefault(); state.close(); }
  if (event.key === "Tab") {
    if (event.shiftKey && (state.active === state.first || !state.containsActive)) { event.preventDefault(); state.last?.focus(); }
    else if (!event.shiftKey && (state.active === state.last || !state.containsActive)) { event.preventDefault(); state.first?.focus(); }
  }
}
