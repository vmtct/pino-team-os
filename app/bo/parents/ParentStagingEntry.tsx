"use client";
/** PAP-2387 / SCH-PARENTS-GUARDIANS: authenticated Staging-only live Parent integration. */
import {useEffect,useMemo,useState} from "react";
import {useBoStagingUser} from "../components/registration/BoRuntimeBoundary";
import {useBoCenterSelection} from "../components/registration/BoCenterSelection";
import {BoRegistrationWorkspace,type BoWorkspaceSource} from "../components/registration/BoRegistrationWorkspace";
import {unifiedBoWorkspaceSource} from "../architecture/bo-unified-workspace-source";
import {RecordState} from "@/app/components/workspace-renderer/Record";
import {ParentDirectoryDsa} from "./ParentDirectoryDsa";
import {ParentLiveScope} from "./parent-live-context";
import {loadNativeParentLiveGrants} from "./parent-native-data";
import {parentNativeModule} from "./parent-native-model";
const source:BoWorkspaceSource={...unifiedBoWorkspaceSource,readOnly:true,modules:{...unifiedBoWorkspaceSource.modules,parents:parentNativeModule},load:async()=>{throw Error("Parent owns scoped native record transport");}};
export function ParentStagingEntry({actorEmail,actorId,canCreate,canEdit}:{actorEmail:string;actorId:string;canCreate:boolean;canEdit:boolean}){
 const user=useBoStagingUser(),center=useBoCenterSelection(),selected=center?.selected??"";
 if(!user||user.email!==actorEmail||!center||center.error)return <RecordState status="denied"/>;
 if(center.loading)return <RecordState status="loading"/>;
 if(!selected||!center.centers.some(c=>c.id===selected))return <RecordState status="denied"/>;
 return <ScopedReview key={actorId+":"+selected+":"+canCreate+":"+canEdit} centerId={selected} actorId={actorId} user={user} canCreate={canCreate} canEdit={canEdit}/>;
}
function ScopedReview({centerId,actorId,user,canCreate,canEdit}:{centerId:string;actorId:string;user:{displayName:string|null};canCreate:boolean;canEdit:boolean}){
 const scope=useMemo(()=>({centerId,actorId,canCreate,canEdit}),[centerId,actorId,canCreate,canEdit]);
 const [state,setState]=useState<"loading"|"denied"|"ready">("loading");
 useEffect(()=>{const ctl=new AbortController();void loadNativeParentLiveGrants(scope,ctl.signal).then(()=>{
   if(!ctl.signal.aborted)setState("ready");
 }).catch(()=>{if(!ctl.signal.aborted)setState("denied");});return()=>ctl.abort();},[scope]);
 if(state!=="ready")return <RecordState status={state}/>;
 return <ParentLiveScope.Provider value={scope}><BoRegistrationWorkspace source={source} moduleKey="parents" currentUser={user} content={<ParentDirectoryDsa/>}/></ParentLiveScope.Provider>;
}
