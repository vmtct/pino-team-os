export function resolveActionBoundIntentId(selectedId: string | null, actionIntentId: string | null): string | null {
  return actionIntentId ?? selectedId;
}

export function shouldRestoreActionBoundIntent(selectedId: string | null, actionIntentId: string | null): boolean {
  return actionIntentId !== null && selectedId !== actionIntentId;
}
