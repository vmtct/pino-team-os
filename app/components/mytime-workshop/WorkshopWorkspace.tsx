"use client";
/** PAP-2161 / MT-WORKSHOP. Reusable native FE; no persistence, identity or business policy invented here. */
import {useCallback,useContext,useEffect,useMemo,useRef,useState} from "react";
import {browserTddNavigation} from "@/lib/workspace-adapters/navigation";
import {TddRenderer} from "@/app/components/workspace-renderer/Renderer";
import {TddDetail,RecordState,TddPreferencePolicy} from "@/app/components/workspace-renderer/Record";
import {WorkshopParticipationTab} from "./WorkshopParticipationTab";
import {BoQuickView} from "@/app/bo/components/registration/BoQuickView";
import {TddHostMenu} from "@/app/components/workspace-adapters/SurfaceWorkspace";
import {fieldValueErrors,type AuthorizationContext,type ModuleRow,type MutationAdapter,type TableQuery} from "@/lib/workspace-schema";
import type {BoRecord,BoValue} from "@/lib/bo-registration";
import {boWorkshopSchema,hoWorkshopSchema,canonicalWorkshopSchema,type WorkshopBinding,type WorkshopFields} from "./schema";
import {WorkshopApiError,ictWorkshopInstant} from "./api-client";
import {workshopEditorValue} from "./datetime";
export type WorkshopRow=ModuleRow<WorkshopFields>;
export type VersionedWorkshop={row:WorkshopRow;version:string};
export type WorkshopInput={name:string;center:string;startAt:string;endAt:string;missions:string[];specialty:string|null;capacity:number|null;eventLead:string|null;academicLead:string|null;otherStaff:string[];facebookUrl:string|null;note:string|null};
export type WorkshopPort={read?:(id:string)=>Promise<VersionedWorkshop>;create:(input:WorkshopInput,key:string)=>Promise<VersionedWorkshop>;update:MutationAdapter<WorkshopFields>;cancel?:(id:string,version:string,key:string)=>Promise<VersionedWorkshop>};
const keys=["name","center","startAt","endAt","missions","specialty","capacity","eventLead","academicLead","otherStaff","facebookUrl","note"] as const;
const blank=():BoRecord=>({id:"",name:"",center:"",startAt:"",endAt:"",missions:[],specialty:"",capacity:null,status:"Đã lên lịch",eventLead:"",academicLead:"",otherStaff:[],facebookUrl:"",note:"",createdAt:null,createdBy:null,updatedAt:null,updatedBy:null});
export function checkWorkshop(input:WorkshopInput){
 if(!input.name.trim()||!input.center||!input.startAt||!input.endAt||!input.missions.length)return "Vui lòng nhập tên, chi nhánh, thời gian và ít nhất một nhiệm vụ.";
 try{if(Date.parse(ictWorkshopInstant(input.endAt))<=Date.parse(ictWorkshopInstant(input.startAt)))return "Thời gian kết thúc phải sau thời gian bắt đầu.";}catch{return "Thời gian không hợp lệ.";}
 if(input.facebookUrl){try{const u=new URL(input.facebookUrl);if(!["http:","https:"].includes(u.protocol))return "Facebook link không hợp lệ.";}catch{return "Facebook link không hợp lệ.";}}
 if(input.capacity!==null&&(!Number.isInteger(input.capacity)||input.capacity<1))return "Sức chứa phải là số nguyên dương.";
 return "";
}
export function WorkshopWorkspace({binding,context,initialRows,port,read,nativeNavigation=false}:{binding:WorkshopBinding;context:AuthorizationContext;initialRows:readonly VersionedWorkshop[];port?:WorkshopPort;read?:(id:string)=>Promise<VersionedWorkshop>;nativeNavigation?:boolean}){
 const {registry,schema,module,fields}=binding,menu=useContext(TddHostMenu);
 const navigation=useMemo(()=>nativeNavigation?browserTddNavigation(schema.surface,schema.surface==="HO"?"mytimeWorkshops":"mytime-workshops",binding.query):null,[nativeNavigation,schema.surface,binding.query]);
 const [rows,setRows]=useState(initialRows),[query,setQuery]=useState<TableQuery<WorkshopFields>>(()=>navigation?.read().query??binding.query);
 const [tab,setTab]=useState("overview");
 const [selected,setSelected]=useState<string|null>(null),[detail,setDetail]=useState(false);
 const [draft,setDraft]=useState<BoRecord|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState("");
 const inFlight=useRef(false),request=useRef<{key:string;input:WorkshopInput}|null>(null),opening=useRef(0),draftOpen=useRef(false),loaded=useRef<{id:string;detail:boolean}|null>(null);
 const [uncertain,setUncertain]=useState(false);
 const allowed=context.surface===schema.surface&&context.authorize(schema.capabilities.read);
 const writable=allowed&&context.surface==="HO"&&!!port&&context.authorize(schema.capabilities.edit!);
 const creatable=allowed&&context.surface==="HO"&&!!port&&context.authorize(schema.capabilities.create!);
 const item=rows.find(r=>r.row.id===selected);
 const close=()=>{if(inFlight.current||uncertain)return;opening.current++;request.current=null;draftOpen.current=false;loaded.current=null;setDraft(null);setSelected(null);setDetail(false);setError("");setTab("overview");if(navigation){navigation.change({kind:"table",tab:"overview",query});navigation.restore();}};
 const open=useCallback(async(id:string,toDetail=false)=>{if(inFlight.current||request.current||draftOpen.current)return;const seq=++opening.current;loaded.current=null;setSelected(null);setDetail(false);setError("");try{const reader=read??port?.read;if(reader){const actual=await reader(id);if(seq!==opening.current)return;if(actual.row.id!==id)throw Error("Workshop không hợp lệ.");setRows(old=>[...old.filter(r=>r.row.id!==id),actual]);}if(seq===opening.current){loaded.current={id,detail:toDetail};setSelected(id);setDetail(toDetail);}}catch{if(seq===opening.current)setError("Không thể đọc Workshop được cấp quyền.");}},[read,port]);
 useEffect(()=>{
  if(!navigation)return;
  const sync=()=>{if(inFlight.current||request.current||draftOpen.current)return;const p=navigation.read();setQuery(p.query);setTab(p.tab==="history"||p.tab==="participation"?p.tab:"overview");if(p.kind==="table"){opening.current++;loaded.current=null;setSelected(null);setDetail(false);}else if(p.recordId){const toDetail=p.kind==="detail";if(loaded.current?.id!==p.recordId||loaded.current?.detail!==toDetail)void open(p.recordId,toDetail);}};
  const unsubscribe=navigation.subscribe(sync);sync();const sequence=opening;return ()=>{sequence.current++;unsubscribe();};
 },[navigation,open]);
 const navigate=(id:string,toDetail=false)=>{if(inFlight.current||request.current||draftOpen.current)return;if(navigation){if(!toDetail)navigation.capture(id);navigation.change({kind:toDetail?"detail":"drawer",recordId:id,tab:"overview",query});}else void open(id,toDetail);};
 const change=(key:string,value:BoValue)=>{if(!creatable||uncertain||inFlight.current||!keys.some(k=>k===key))return;let next=value;if((key==="startAt"||key==="endAt")&&value){try{next=ictWorkshopInstant(String(value));}catch{setError("Thời gian không hợp lệ.");return;}}setDraft(old=>old?{...old,[key]:next}:old);setError("");};
 const create=async()=>{
  if(!draft||!creatable||!port||inFlight.current)return;
  const input:WorkshopInput={name:String(draft.name??"").trim(),center:String(draft.center??""),startAt:String(draft.startAt??""),endAt:String(draft.endAt??""),missions:Array.isArray(draft.missions)?draft.missions.map(String):[],specialty:String(draft.specialty??"")||null,capacity:draft.capacity==null||draft.capacity===""?null:Number(draft.capacity),eventLead:String(draft.eventLead??"")||null,academicLead:String(draft.academicLead??"")||null,otherStaff:Array.isArray(draft.otherStaff)?draft.otherStaff.map(String):[],facebookUrl:String(draft.facebookUrl??"").trim()||null,note:String(draft.note??"").trim()||null};
  const invalid=checkWorkshop(input)||fields.filter(f=>keys.some(k=>k===f.key)&&fieldValueErrors(f,input[f.key as keyof WorkshopInput]).length).map(f=>f.label).join(", ");
  if(invalid){setError(invalid);return;}
  inFlight.current=true;setBusy(true);setError("");
  const attempt=request.current??{key:globalThis.crypto?.randomUUID?.()??"workshop-"+Date.now(),input};request.current=attempt;
  try{const created=await port.create(attempt.input,attempt.key);setUncertain(false);setRows(old=>[...old.filter(r=>r.row.id!==created.row.id),created]);setSelected(created.row.id);setDetail(false);loaded.current={id:created.row.id,detail:false};draftOpen.current=false;setDraft(null);request.current=null;if(navigation)navigation.change({kind:"drawer",recordId:created.row.id,tab:"overview",query});}
  catch(e){const known=e instanceof WorkshopApiError&&[400,401,403,409,422].includes(e.status);if(known||!port.read){request.current=null;setUncertain(false);}else{setUncertain(true);}setError(known||!port.read?(e instanceof Error?e.message:"Không thể tạo Workshop."):"Chưa xác nhận kết quả. Bấm tạo lại để kiểm tra cùng yêu cầu.");}
  finally{inFlight.current=false;setBusy(false);}
 };
 const save=(row:WorkshopRow,version:string)=>setRows(old=>old.map(r=>r.row.id===row.id?{row,version}:r));
 const cancel=async()=>{if(!item||!writable||item.row.status==="Đã hủy"||!port?.cancel||inFlight.current||!window.confirm("Hủy Workshop "+item.row.name+"?"))return;inFlight.current=true;setBusy(true);setError("");try{const result=await port.cancel(item.row.id,item.version,globalThis.crypto?.randomUUID?.()??"cancel-"+Date.now());save(result.row,result.version);}catch(e){setError(e instanceof Error?e.message:"Không thể hủy Workshop.");}finally{inFlight.current=false;setBusy(false);}};
 if(!allowed)return <RecordState status="denied"/>;
 return <TddPreferencePolicy.Provider value="ephemeral">
  {!draft&&error?<p role="alert">{error}</p>:null}
  <div hidden={detail}><TddRenderer view={{kind:"table",mobileMenu:menu("mytime-workshops-menu"),headerActions:creatable?<button type="button" className="primary-btn" disabled={busy||uncertain||!!draft} onClick={()=>{if(inFlight.current||request.current||draft)return;opening.current++;request.current=null;draftOpen.current=true;loaded.current=null;setDraft(blank());setSelected(null);setError("");}}>Thêm Workshop</button>:null,props:{registry,schema:nativeNavigation?(schema.surface==="HO"?canonicalWorkshopSchema(hoWorkshopSchema,schema):canonicalWorkshopSchema(boWorkshopSchema,schema)):schema,context,rows:rows.map(r=>r.row),query,status:"ready",onQueryChange:q=>{setQuery(q);if(navigation)navigation.change({...navigation.read(),query:q},true);},onOpen:r=>navigate(r.id)}}}/></div>
  {detail&&item?<TddDetail registry={registry} schema={schema} context={context} record={item.row} subject={{type:"mytime_workshop",id:item.row.id}} mobileMenu={menu("workshop-detail-menu")} onBack={close} activeTab={navigation?tab:undefined} onTabChange={navigation?id=>{setTab(id);navigation.change({...navigation.read(),tab:id},true);}:undefined} renderApprovedExtension={schema.surface==="BO"?(_record,_context,active)=>active==="participation"?<WorkshopParticipationTab workshopName={String(item.row.name??"")} rows={[]} canCreate={false} unavailable/>:null:undefined} overviewAfter={writable&&port?.cancel&&item.row.status!=="Đã hủy"?<button type="button" className="secondary-btn" disabled={busy} onClick={()=>void cancel()}>Hủy Workshop</button>:null} writes={writable&&port&&item.row.status!=="Đã hủy"?{adapter:port.update,version:item.version,editorValue:workshopEditorValue,onSaved:save}:undefined}/>:null}
  {draft||item&&!detail?<BoQuickView key={draft?"create":item!.row.id} module={module} moduleKey="mytime-workshops" record={draft?null:{...item!.row,missions:[...(item!.row.missions??[])],otherStaff:[...(item!.row.otherStaff??[])],name:String(item!.row.name??"")}} onClose={close} onDetail={()=>{if(item)navigate(item.row.id,true);}} create={draft?{draft,editable:f=>creatable&&!busy&&!uncertain&&keys.some(k=>k===f.key),editorField:f=>({...f,readonly:false}),editorValue:workshopEditorValue,onChange:change,onCreate:create,busy,error,title:"Thêm Workshop",path:"Workshop MyTime"}:undefined}/>:null}


 </TddPreferencePolicy.Provider>;
}
