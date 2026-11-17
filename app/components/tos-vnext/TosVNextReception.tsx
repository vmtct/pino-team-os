"use client";
import type { Assignment, TimekeepingSession } from "@/lib/workforce-api";
import { ownReceptionAssignments } from "@/lib/tos-vnext-reception";
import ReceptionV4Presentation from "./ReceptionV4Presentation";
import { OpenStudioReceptionPanel } from "./OpenStudioReceptionPanel";
import { ReceptionHouseCheckIn } from "./ReceptionHouseCheckIn";

/** PAP-942 shell, PAP-1239 CP1 physical House check-in.
 * Never use the session Day-of-Learning check-in as an unprojected Presence writer.
 */
export function TosVNextReception({
  centerId, workDate, assignments, currentSession=null, centerName = "", profileLabel = "",
}: {
  centerId: string;
  workDate: string;
  assignments: readonly Assignment[];
  currentSession?: TimekeepingSession|null;
  centerName?: string;
  profileLabel?: string;
}) {
  const today = ownReceptionAssignments(assignments, centerId, workDate);
  const shiftTime = today.map(a =>
    (a.effectiveStartLocal || a.shift?.startLocalTime || "Chưa có giờ")
    + " — " + (a.effectiveEndLocal || a.shift?.endLocalTime || "Chưa có giờ"),
  ).join(" · ") || "Không có ca trong lịch hôm nay";

  return <ReceptionV4Presentation
    key={centerId + ":" + workDate}
    centerName={centerName}
    profileLabel={profileLabel}
    workDate={workDate}
    shiftTime={shiftTime}
    slots={Array.from(new Map(today.map(a=>[a.shiftTemplateId,{centerId,workDate,shiftTemplateId:a.shiftTemplateId,
      label:(a.shift?.displayLabel??"Ca tiếp tân")+" · "+(a.shift?.startLocalTime??"")+" — "+(a.shift?.endLocalTime??"")}])).values())}
    visitLookup={<>
      <ReceptionHouseCheckIn centerId={centerId} />
      <OpenStudioReceptionPanel
        key={centerId + ":" + workDate} centerId={centerId}
        workDate={workDate} assignments={assignments} session={currentSession}
      />
    </>}
  />;
}
