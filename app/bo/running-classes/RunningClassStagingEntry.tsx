"use client";
/** PLT-DELIVERY / PAP-2225: actual authenticated BO boundary; no canonical write or real record projection. */
import {useEffect,useState} from "react";
import {BoRegistrationWorkspace,type BoWorkspaceSource} from "../components/registration/BoRegistrationWorkspace";
import {useBoCenterSelection} from "../components/registration/BoCenterSelection";
import {useBoStagingUser} from "../components/registration/BoRuntimeBoundary";
import {canReviewRunningClass} from "./running-class-review-access";
import {boApi} from "@/lib/bo-api";
import {RecordState,TddPreferencePolicy} from "@/app/components/workspace-renderer/Record";
import school from "@/public/bo-authority-source/school-adapters.js";
import {createRunningClassReview} from "./running-class-review";
import {classTableModule} from "./running-class-presentation";
import {RC_REVIEW_PATH} from "./running-class-review-query";

export function RunningClassStagingEntry(){
 const user=useBoStagingUser(),center=useBoCenterSelection();
 const selected=center?.selected??"";
 if(!user||!center||center.error)return <RecordState status="denied"/>;
 if(center.loading)return <RecordState status="loading"/>;
 if(!selected||!center.centers.some(c=>c.id===selected))return <RecordState status="denied"/>;
 return <ScopedReview key={selected} centerId={selected} user={user}/>;
}
function ScopedReview({centerId,user}:{centerId:string;user:{displayName:string|null}}){
 const [state,setState]=useState<"loading"|"denied"|"ready">("loading");
 const [source]=useState<BoWorkspaceSource>(()=>{const review=createRunningClassReview();return {
  ephemeral:true,modules:{...school.modules,classes:classTableModule(school.modules.classes)},runningClassReview:review,
  routeForModule:key=>key==="classes"?RC_REVIEW_PATH:"/bo?module="+encodeURIComponent(key),
  scopeLabel:()=>"M1 · Dữ liệu mẫu — không ghi vào hệ thống",
  load:async key=>{if(key!=="classes")throw Error("Fixture module only");return review.list();}
 };});
 useEffect(()=>{const abort=new AbortController();void canReviewRunningClass(centerId,boApi.context,fetch,abort.signal).then(allowed=>{if(!abort.signal.aborted)setState(allowed?"ready":"denied");});return()=>abort.abort();},[centerId]);
 if(state!=="ready")return <RecordState status={state}/>;
 return <TddPreferencePolicy.Provider value="ephemeral"><BoRegistrationWorkspace source={source} moduleKey="classes" options={{centerId}} currentUser={user}/></TddPreferencePolicy.Provider>;
}
