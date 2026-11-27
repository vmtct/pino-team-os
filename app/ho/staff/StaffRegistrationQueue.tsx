"use client";
// PAP-2420 · WFM-STAFF. Separate dossier view within the native HO Staff module.
import {useState} from "react";
import {SurfaceWorkspace} from "@/app/components/workspace-adapters/SurfaceWorkspace";
import type {AuthenticatedSurfaceAdapter} from "@/lib/workspace-adapters/contracts";
import type {AdapterNavigation,AdapterLocation} from "@/lib/workspace-adapters/navigation";
import type {ManualStaffFields} from "./manual-create-contract";
import {registrationQueueQuery} from "./staff-registration-queue-contract";
import {StaffRegistrationFinalization} from "./StaffRegistrationFinalization";
import type {createFinalizationFixture,FinalizationResult,FinalizeRequest,ReviewedDossierReceipt} from "./staff-registration-finalization-preview";

type Fixture=ReturnType<typeof createFinalizationFixture>;
type Props={adapter:AuthenticatedSurfaceAdapter<ManualStaffFields>;fixture:Fixture;centerLabel:string;onBack:()=>void;tableHeaderActions?:React.ReactNode;navigation?:AdapterNavigation<ManualStaffFields>;newKey?:()=>string;finalize:(r:FinalizeRequest)=>FinalizationResult;reject:(r:ReviewedDossierReceipt,reason:string,key:string)=>FinalizationResult};
export function StaffRegistrationQueue({adapter,fixture,centerLabel,onBack,tableHeaderActions,navigation:providedNavigation,newKey,finalize,reject}:Props){
 const [revision,setRevision]=useState(0);
 const [navigation]=useState<AdapterNavigation<ManualStaffFields>>(()=>{
 let current:AdapterLocation<ManualStaffFields>={kind:"table",tab:"overview",query:registrationQueueQuery},focused:HTMLElement|null=null;
 const listeners=new Set<()=>void>();
 return {read:()=>current,change(next){if(next.kind!=="table"&&next.recordId!==fixture.dossier().id)throw Error("Foreign dossier");current=next;listeners.forEach(fn=>fn());},subscribe(fn){listeners.add(fn);return()=>{listeners.delete(fn);};},capture(){focused=document.activeElement instanceof HTMLElement?document.activeElement:null;},restore(){requestAnimationFrame(()=>focused?.isConnected&&focused.focus());}};
 });
 const [keys]=useState(()=>{let n=0;return ()=>"HO-M1-DECISION-"+String(++n);});
 return <SurfaceWorkspace key={revision} adapter={adapter} navigation={providedNavigation??navigation} initialQuery={registrationQueueQuery} drawerReadOnly tableHeaderActions={tableHeaderActions??<button type="button" className="secondary-btn" onClick={onBack}>Danh sách nhân sự</button>} detailOverview={row=>{
 if(row.id!==fixture.dossier().id)return null;
 const result=fixture.readback(),decision=result&&(result.kind==="approved"||result.kind==="rejected")?result:null;
 return <><StaffRegistrationFinalization dossier={fixture.dossier()} centerLabel={centerLabel} roles={fixture.roles()} decision={decision} port={{finalize:async r=>finalize(r),reject:async(r,reason,key)=>reject(r,reason,key),readback:async()=>fixture.readback(),newKey:newKey??keys}} onDecision={()=>setRevision(r=>r+1)}/><p><button type="button" className="secondary-btn" onClick={onBack}>Danh sách nhân sự</button></p></>;
 }}/>;
}
