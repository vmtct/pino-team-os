"use client";
/** PAP-2387 / SCH-PARENTS-GUARDIANS: authenticated Staging-only M1-B presentation. */
import {useEffect,useState} from "react";
import {useBoStagingUser} from "../components/registration/BoRuntimeBoundary";
import {useBoCenterSelection} from "../components/registration/BoCenterSelection";
import {BoRegistrationWorkspace,type BoWorkspaceSource} from "../components/registration/BoRegistrationWorkspace";
import {unifiedBoWorkspaceSource} from "../architecture/bo-unified-workspace-source";
import {RecordState,TddPreferencePolicy} from "@/app/components/workspace-renderer/Record";
import {ParentDirectoryDsa} from "./ParentDirectoryDsa";
import {ParentStagingFixtureProvider} from "./parent-m1-context";
import {loadNativeParentContext} from "./parent-native-data";
import {parentNativeModule} from "./parent-native-model";
const source:BoWorkspaceSource={...unifiedBoWorkspaceSource,ephemeral:true,readOnly:true,modules:{...unifiedBoWorkspaceSource.modules,parents:parentNativeModule},load:async()=>{throw Error("Parent M1-B has no record transport");}};
export function ParentStagingEntry({actorEmail,actorId,canCreate,canEdit}:{actorEmail:string;actorId:string;canCreate:boolean;canEdit:boolean}){
 const user=useBoStagingUser(),center=useBoCenterSelection(),selected=center?.selected??"";
 if(!user||user.email!==actorEmail||!center||center.error)return <RecordState status="denied"/>;
 if(center.loading)return <RecordState status="loading"/>;
 if(!selected||!center.centers.some(c=>c.id===selected))return <RecordState status="denied"/>;
 return <ScopedReview key={actorId+":"+selected+":"+canCreate+":"+canEdit} centerId={selected} user={user} canCreate={canCreate} canEdit={canEdit}/>;
}
function ScopedReview({centerId,user,canCreate,canEdit}:{centerId:string;user:{displayName:string|null};canCreate:boolean;canEdit:boolean}){
 const [state,setState]=useState<{status:"loading"|"denied"}|{status:"ready";grants:ReadonlySet<string>}>({status:"loading"});
 useEffect(()=>{const ctl=new AbortController();void loadNativeParentContext(centerId,ctl.signal).then(grants=>{
   if(ctl.signal.aborted)return;
   const effective=new Set<string>();
   if(canCreate&&grants.has("identity.parent.create"))effective.add("identity.parent.create");
   if(canEdit&&grants.has("identity.parent.edit"))effective.add("identity.parent.edit");
   setState({status:"ready",grants:effective});
 }).catch(()=>{if(!ctl.signal.aborted)setState({status:"denied"});});return()=>ctl.abort();},[centerId,canCreate,canEdit]);
 if(state.status!=="ready")return <RecordState status={state.status}/>;
 return <TddPreferencePolicy.Provider value="ephemeral"><ParentStagingFixtureProvider grants={state.grants}><BoRegistrationWorkspace source={source} moduleKey="parents" currentUser={user} content={<ParentDirectoryDsa/>}/></ParentStagingFixtureProvider></TddPreferencePolicy.Provider>;
}
