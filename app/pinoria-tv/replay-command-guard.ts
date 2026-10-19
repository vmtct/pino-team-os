/** Pure TV replay fence. Does not dispatch, acknowledge, or rerun domain effects. */
export type TvReplayCursor = { centerId: string; displayId: string; sessionId: string; revision: number; activePresentationId: string | null };
export type TvReplayInstruction = TvReplayCursor & { presentationId: string };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** Only a newer command addressed to this exact runtime session is eligible for replay. */
export function acceptsTvReplayInstruction(cursor: TvReplayCursor, instruction: TvReplayInstruction): boolean {
  return UUID.test(instruction.presentationId) &&
    cursor.activePresentationId === instruction.presentationId &&
    !!cursor.centerId && !!cursor.displayId && !!cursor.sessionId &&
    instruction.centerId === cursor.centerId && instruction.displayId === cursor.displayId &&
    instruction.sessionId === cursor.sessionId &&
    Number.isSafeInteger(cursor.revision) && cursor.revision >= 0 &&
    Number.isSafeInteger(instruction.revision) && instruction.revision > cursor.revision;
}
