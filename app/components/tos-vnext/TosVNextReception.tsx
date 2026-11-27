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
import {readReceptionWishCount} from "@/lib/tos-pls-wish-client";
import {ReceptionHandoverPanel} from "./ReceptionHandoverPanel";
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
  const [wishRevision,setWishRevision]=useState(0);
  const [wishSnapshot,setWishSnapshot]=useState<{key:string;count:number|null}|null>(null);
  const wishKey=JSON.stringify([centerId,workDate,wishRevision]);
  const refreshWish=useCallback(()=>setWishRevision(v=>v+1),[]);
  useEffect(()=>{
    if(!wishEnabled||!centerId||!workDate)return;
    const c=new AbortController();
    void readReceptionWishCount(centerId,workDate,c.signal).then(count=>{if(!c.signal.aborted)setWishSnapshot({key:wishKey,count});}).catch(()=>{if(!c.signal.aborted)setWishSnapshot({key:wishKey,count:null});});
    return ()=>c.abort();
  },[wishEnabled,centerId,workDate,wishKey]);
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
    wishSupportedCount={wishEnabled&&wishSnapshot?.key===wishKey?wishSnapshot.count:null}
    wishCandidates={day?Object.values(day.activeVisits).filter(v=>v.checkedOutAt===null).map(v=>({learnerId:v.studentProfileId,visitId:v.id})):[]}
    wishEnabled={wishEnabled}
    renderWish={(guest,visitId)=><TosWishRuntime key={visitId} centerId={centerId} learnerId={guest.id} legalName={guest.name} gender={null} onCommitted={refreshWish}/>}
    renderHandover={(guest,close)=>{
      const visit=day?.activeVisits[guest.id];
      if(!visit||visit.checkedOutAt!==null)return <p role="status">Chưa xác minh được lượt đến hiện tại.</p>;
      return <ReceptionHandoverPanel scope={{centerId,studentProfileId:guest.id,expectedVisitId:visit.id,expectedVersion:visit.version}} onDone={()=>{refresh();close();}}/>;
    }}
    showDayList
    visitLookup={<>
      <ReceptionHouseCheckIn key={centerId} centerId={centerId} loadRecentLearners={tosReceptionHouseApi.recent} onVisitChanged={refresh} onWishCommitted={refreshWish} />
      <OpenStudioReceptionPanel
        key={centerId + ":" + workDate} centerId={centerId}
        workDate={workDate} assignments={assignments} session={currentSession}
      />
    </>}
  />;
}
