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
  // Temporary product policy: briefing remains visible/acknowledgeable but advisory for check-in.
  // Board context must still load; assignment/auth/WFM-TIME gates remain authoritative elsewhere.
  return input.boardLoaded;
}
