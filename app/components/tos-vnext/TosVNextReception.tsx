"use client";
import { useCallback, useEffect, useState } from "react";
import {readReceptionDay,receptionShiftActivity,type ReceptionDayReadModel} from "@/lib/tos-reception-day-api";
import {unavailableOpsReadModel} from "@/lib/tos-ops-v4-view-model";
import type { Assignment, TimekeepingSession } from "@/lib/workforce-api";
import { ownReceptionAssignments } from "@/lib/tos-vnext-reception";
import ReceptionV4Presentation from "./ReceptionV4Presentation";
import { OpenStudioReceptionPanel } from "./OpenStudioReceptionPanel";
import { ReceptionHouseCheckIn } from "./ReceptionHouseCheckIn";
import { tosReceptionHouseApi } from "@/lib/tos-reception-house-api";
import {TosWishRuntime,useTosWishEnabled} from "./TosWishRuntime";

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
  const wishEnabled=useTosWishEnabled();
  const [revision,setRevision]=useState(0);
  const [snapshot,setSnapshot]=useState<{key:string;day:ReceptionDayReadModel|null}|null>(null);
  const key=JSON.stringify([centerId,workDate,revision]);
  const refresh=useCallback(()=>setRevision(v=>v+1),[]);
  useEffect(()=>{
    if(!centerId||!workDate)return;
    const controller=new AbortController();
    void readReceptionDay(centerId,workDate,controller.signal).then(day=>{
      if(!controller.signal.aborted)setSnapshot({key,day});
    }).catch(()=>{if(!controller.signal.aborted)setSnapshot({key,day:null});});
    return ()=>controller.abort();
  },[centerId,workDate,key]);
  const day=snapshot?.key===key?snapshot.day:null;
  const windows=today.flatMap<{startsLocal:string;endsLocal:string}>(a=>{
    if(a.effectiveWork?.reconciliationRequired)return [];
    if(a.effectiveWork?.windows.length)return a.effectiveWork.windows;
    const startsLocal=a.effectiveStartLocal||a.shift?.startLocalTime;
    const endsLocal=a.effectiveEndLocal||a.shift?.endLocalTime;
    return startsLocal&&endsLocal?[{startsLocal,endsLocal}]:[];
  });
  const activity=day&&!today.some(a=>a.effectiveWork?.reconciliationRequired)?receptionShiftActivity(day,windows):null;
  const model=day?{...unavailableOpsReadModel(),loaded:true,guests:day.guests,attendance:day.attendance,events:activity??[]}:unavailableOpsReadModel();
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
    compactArrivalIntro
    model={model}
    activityLoaded={activity!==null}
    expectedComplete={day?.unresolvedRegistrations===0&&!day.hasRosterConflict}
    wishLoaded={false}
    wishCandidates={day?Object.values(day.activeVisits).filter(v=>v.checkedOutAt===null).map(v=>({learnerId:v.studentProfileId,visitId:v.id})):[]}
    wishEnabled={wishEnabled}
    renderWish={(guest,visitId)=><TosWishRuntime key={visitId} centerId={centerId} learnerId={guest.id} legalName={guest.name} gender={null}/>}
    showDayList
    visitLookup={<>
      <ReceptionHouseCheckIn key={centerId} centerId={centerId} loadRecentLearners={tosReceptionHouseApi.recent} onVisitChanged={refresh} />
      <OpenStudioReceptionPanel
        key={centerId + ":" + workDate} centerId={centerId}
        workDate={workDate} assignments={assignments} session={currentSession}
      />
    </>}
  />;
}
