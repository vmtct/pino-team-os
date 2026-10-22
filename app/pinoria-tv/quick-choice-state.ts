export type QuickChoicePhase = "ARRIVAL" | "QUICK_CHOICE" | "AMBIENT";
export type QuickChoiceState = {
  visitId: string;
  studentProfileId: string;
  phase: QuickChoicePhase;
  deadlineMs: number | null;
  selectedCommandKey: string | null;
};
export type ChoiceCandidate = { id: string; kind: "OWNED" | "SHOP"; pricePls: number | null };
export function beginQuickChoice(visitId: string, studentProfileId: string, candidates: readonly ChoiceCandidate[], nowMs: number, durationMs = 8000): QuickChoiceState {
  if (!visitId || !studentProfileId || !Number.isFinite(nowMs) || !Number.isSafeInteger(durationMs) || durationMs <= 0)
    throw new Error("QUICK_CHOICE_INVALID_ENTRY");
  if (candidates.length > 6 || new Set(candidates.map(x => x.id)).size !== candidates.length ||
    candidates.some(x => !x.id || (x.kind === "OWNED" ? x.pricePls !== null : !Number.isSafeInteger(x.pricePls) || (x.pricePls ?? -1) < 0)))
    throw new Error("QUICK_CHOICE_INVALID_OPTIONS");
  return { visitId, studentProfileId, phase: candidates.length ? "QUICK_CHOICE" : "AMBIENT", deadlineMs: candidates.length ? nowMs + durationMs : null, selectedCommandKey: null };
}
export function expireQuickChoice(state: QuickChoiceState, nowMs: number): QuickChoiceState {
  if (state.phase !== "QUICK_CHOICE" || state.deadlineMs === null || nowMs < state.deadlineMs) return state;
  return { ...state, phase: "AMBIENT", deadlineMs: null };
}
export function confirmQuickChoice(state: QuickChoiceState, result: { visitId: string; studentProfileId: string; commandKey: string; serverConfirmed: boolean }, nowMs: number): QuickChoiceState {
  const current = expireQuickChoice(state, nowMs);
  if (current.phase !== "QUICK_CHOICE" || !result.serverConfirmed || result.visitId !== state.visitId || result.studentProfileId !== state.studentProfileId || !result.commandKey)
    throw new Error("QUICK_CHOICE_INVALID_CONFIRMATION");
  return { ...current, phase: "AMBIENT", deadlineMs: null, selectedCommandKey: result.commandKey };
}
