type CalendarPreviewCommand = {
  centerId: string;
  scopeType: "HOUSE" | "PATH" | "RUNNING_CLASS";
  pathProgramId?: string;
  runningClassId?: string;
  startsOnLocalDate: string;
  endsBeforeLocalDate: string;
};

export function calendarPreviewFingerprint(command: CalendarPreviewCommand): string {
  return JSON.stringify([
    command.centerId, command.scopeType, command.pathProgramId ?? null, command.runningClassId ?? null,
    command.startsOnLocalDate, command.endsBeforeLocalDate,
  ]);
}

export function calendarPreviewMatches(requestedFingerprint: string, currentFingerprint: string | null): boolean {
  return requestedFingerprint === currentFingerprint;
}
