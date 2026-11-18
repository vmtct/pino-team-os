"use client";
/** PAP-2181 / SCH-ENROLLMENT. Native read-only TDD; data and authorized relation routes supplied by host. */
import {useContext,useState} from "react";
import {TddRenderer} from "@/app/components/workspace-renderer/Renderer";
import {TddDetail,RecordState,TddPreferencePolicy} from "@/app/components/workspace-renderer/Record";
import {BoQuickView} from "@/app/bo/components/registration/BoQuickView";
import {TddHostMenu} from "@/app/components/workspace-adapters/SurfaceWorkspace";
import type {AuthorizationContext,ModuleRow,TableQuery} from "@/lib/workspace-schema";
import {registry,enrollmentSchema,enrollmentModule,queryDefault,type EnrollmentFields} from "./schema";
export type EnrollmentRow = ModuleRow<EnrollmentFields>;
type RelatedLink = Readonly<{label:string;href:string}>;
export function BoEnrollmentDirectory({context,rows,relationLinks}:{context:AuthorizationContext;rows:readonly EnrollmentRow[];relationLinks?:(row:EnrollmentRow)=>readonly RelatedLink[]}) {
 const menu=useContext(TddHostMenu);
 const [query,setQuery]=useState<TableQuery<EnrollmentFields>>(queryDefault);
 const [selected,setSelected]=useState<string|null>(null);
 const [detail,setDetail]=useState(false);
 const [tab,setTab]=useState("overview");
 const record=rows.find(row=>row.id===selected);
 const close=()=>{setSelected(null);setDetail(false);setTab("overview");};
 if(context.surface!=="BO"||!context.authorize(enrollmentSchema.capabilities.read))return <RecordState status="denied"/>;
 const links=record?relationLinks?.(record):undefined;
 const related=links?.length?<nav aria-label="Hồ sơ liên quan">{links.map(link=><p key={link.href}><a href={link.href}>{link.label}</a></p>)}</nav>:null;
 return <TddPreferencePolicy.Provider value="ephemeral">
  <div hidden={detail&&!!record}><TddRenderer view={{kind:"table",mobileMenu:menu("enrollment-menu"),props:{registry,schema:enrollmentSchema,context,rows,query,status:"ready",onQueryChange:setQuery,onOpen:r=>{setSelected(r.id);setDetail(false);setTab("overview");}}}}/></div>
  {detail&&record?<TddDetail registry={registry} schema={enrollmentSchema} context={context} record={record} subject={{type:"enrollment",id:record.id}} mobileMenu={menu("enrollment-detail-menu")} activeTab={tab} onTabChange={setTab} onBack={close} overviewAfter={related}/>:null}
  {!detail&&record?<BoQuickView key={record.id} module={enrollmentModule} moduleKey="enrollments" record={{...record,name:String(record.name??"")}} onClose={close} onDetail={()=>setDetail(true)} extraSection={related}/>:null}
 </TddPreferencePolicy.Provider>;
}
