type Focusable = { focus(): void };
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
