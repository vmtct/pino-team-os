import type { StaffDutyAcknowledgement, StaffDutyBriefing } from "./workforce-api";

export function isCurrentBriefingAcknowledged(
  briefing: StaffDutyBriefing | null,
  acknowledgement: StaffDutyAcknowledgement | null,
) {
  return Boolean(
    briefing
    && acknowledgement
    && acknowledgement.briefingRef === briefing.briefingRef
    && acknowledgement.briefingRevision === briefing.revision,
  );
}

export function briefingCheckInReady(input: {
  boardLoaded: boolean;
  briefing: StaffDutyBriefing | null;
  acknowledgement: StaffDutyAcknowledgement | null;
}) {
  if (!input.boardLoaded) return false;
  return !input.briefing || isCurrentBriefingAcknowledged(input.briefing, input.acknowledgement);
}
