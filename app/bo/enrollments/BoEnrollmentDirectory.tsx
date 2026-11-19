"use client";
/** PAP-2181 / SCH-ENROLLMENT. Native read-only TDD; data and authorized relation routes supplied by host. */
import {useCallback,useContext,useEffect,useMemo,useRef,useState} from "react";
import {TddRenderer} from "@/app/components/workspace-renderer/Renderer";
import {TddDetail,RecordState,TddPreferencePolicy} from "@/app/components/workspace-renderer/Record";
import {BoQuickView} from "@/app/bo/components/registration/BoQuickView";
import {TddHostMenu} from "@/app/components/workspace-adapters/SurfaceWorkspace";
import type {AuthorizationContext,ModuleRow,ModuleSchema,TddRegistry,TableQuery} from "@/lib/workspace-schema";
import {browserTddNavigation} from "@/lib/workspace-adapters/navigation";
import {registry,enrollmentSchema,enrollmentModule,queryDefault,canonicalEnrollmentSchema,type EnrollmentFields} from "./schema";
export type EnrollmentRow = ModuleRow<EnrollmentFields>;
type RelatedLink = Readonly<{label:string;href:string}>;
export function BoEnrollmentDirectory({context,rows,relationLinks,binding,readRecord}:{context:AuthorizationContext;rows:readonly EnrollmentRow[];relationLinks?:(row:EnrollmentRow)=>readonly RelatedLink[];binding?:{registry:TddRegistry;schema:ModuleSchema<EnrollmentFields>};readRecord?:(id:string,signal:AbortSignal)=>Promise<EnrollmentRow|null>}) {
 const activeRegistry=binding?.registry??registry,activeSchema=binding?.schema??enrollmentSchema;
 const navigation=useMemo(()=>binding?browserTddNavigation("BO","enrollments",queryDefault):null,[binding]);
 const request=useRef<AbortController|null>(null);
 const [fresh,setFresh]=useState<EnrollmentRow|null>(null);
 const [error,setError]=useState("");
 const [loading,setLoading]=useState(false);
 const menu=useContext(TddHostMenu);
 const [query,setQuery]=useState<TableQuery<EnrollmentFields>>(()=>navigation?.read().query??queryDefault);
 const [selected,setSelected]=useState<string|null>(null);
 const [detail,setDetail]=useState(false);
 const [tab,setTab]=useState("overview");
 const record=readRecord?(fresh?.id===selected?fresh:null):rows.find(row=>row.id===selected);
 const clear=useCallback(()=>{request.current?.abort();setFresh(null);setSelected(null);setDetail(false);setTab("overview");setLoading(false);setError("");},[]);
 const open=useCallback((id:string,toDetail:boolean,nextTab="overview")=>{
  request.current?.abort();setSelected(id);setDetail(toDetail);setTab(nextTab);setError("");setFresh(null);
  if(!readRecord)return;
  const ctl=new AbortController();request.current=ctl;setLoading(true);
  void readRecord(id,ctl.signal).then(row=>{if(ctl.signal.aborted)return;setLoading(false);if(row?.id===id)setFresh(row);else setError("Lịch học không còn được cấp quyền.");},()=>{if(!ctl.signal.aborted){setLoading(false);setError("Không thể tải lịch học được cấp quyền.");}});
 },[readRecord]);
 useEffect(()=>{if(!navigation)return;const sync=()=>{const next=navigation.read();setQuery(next.query);if(next.kind==="table")clear();else if(next.recordId)open(next.recordId,next.kind==="detail",next.tab);};sync();const unsubscribe=navigation.subscribe(sync);return()=>{unsubscribe();request.current?.abort();};},[navigation,clear,open]);
 const close=()=>{clear();if(navigation){navigation.change({kind:"table",tab:"overview",query});navigation.restore();}};
 if(context.surface!=="BO"||!context.authorize(activeSchema.capabilities.read))return <RecordState status="denied"/>;
 const links=record?relationLinks?.(record):undefined;
 const related=links?.length?<nav aria-label="Hồ sơ liên quan">{links.map(link=><p key={link.href}><a href={link.href}>{link.label}</a></p>)}</nav>:null;
 return <TddPreferencePolicy.Provider value="ephemeral">
  {error?<p role="alert">{error}</p>:loading?<p role="status">Đang tải lịch học…</p>:null}
  <div hidden={detail&&!!record}><TddRenderer view={{kind:"table",mobileMenu:menu("enrollment-menu"),props:{registry:activeRegistry,schema:canonicalEnrollmentSchema(enrollmentSchema,activeSchema),context,rows,query,status:"ready",onQueryChange:q=>{setQuery(q);if(navigation)navigation.change({...navigation.read(),query:q},true);},onOpen:r=>{if(navigation){navigation.capture(r.id);navigation.change({kind:"drawer",recordId:r.id,tab:"overview",query});}else open(r.id,false);}}}}/></div>
  {detail&&record?<TddDetail registry={activeRegistry} schema={activeSchema} context={context} record={record} subject={{type:"enrollment",id:record.id}} mobileMenu={menu("enrollment-detail-menu")} activeTab={tab} onTabChange={v=>{setTab(v);if(navigation&&record)navigation.change({kind:"detail",recordId:record.id,tab:v,query},true);}} onBack={close} overviewAfter={related}/>:null}
  {!detail&&record?<BoQuickView key={record.id} module={enrollmentModule} moduleKey="enrollments" record={{...record,name:String(record.name??"")}} onClose={close} onDetail={()=>{if(navigation&&record)navigation.change({kind:"detail",recordId:record.id,tab:"overview",query});else setDetail(true);}} extraSection={related}/>:null}
 </TddPreferencePolicy.Provider>;
}
