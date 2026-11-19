"use client";
/** PAP-2145 / MT-GUEST. Native reusable composition; data/commands injected, never inferred from role. */
import {useContext,useEffect,useMemo,useRef,useState} from "react";
import {TddRenderer} from "@/app/components/workspace-renderer/Renderer";
import {TddDetail,RecordState,TddPreferencePolicy} from "@/app/components/workspace-renderer/Record";
import {BoQuickView} from "@/app/bo/components/registration/BoQuickView";
import {TddHostMenu} from "@/app/components/workspace-adapters/SurfaceWorkspace";
import {fieldValueErrors,type TddRegistry,type AuthorizationContext,type ModuleRow,type ModuleSchema,type MutationAdapter,type TableQuery} from "@/lib/workspace-schema";
import {GuestParentCommitted,guestKnownFailure} from "./guardian-recovery";
import {browserTddNavigation} from "@/lib/workspace-adapters/navigation";
import type {BoRecord,BoValue} from "@/lib/bo-registration";
import {GuardianPreview,blankGuardian,guardianIssue,type GuardianDraft,type GuardianOption} from "./GuardianPreview";
import {EDIT,READ,fields,queryDefault,registry,guestSchema,guestModule,type GuestFields} from "./schema";
export type GuestRow=ModuleRow<GuestFields>;
export type VersionedGuest={row:GuestRow;version:string};
export type GuestCreateInput={name:string;gender:string;phone:string;birthDate:string;email:string;note:string;category:string;guardianDraft?:GuardianDraft;guardianParentId?:string};
export type GuestPort={create:(input:GuestCreateInput,key:string)=>Promise<VersionedGuest>;read?:(id:string)=>Promise<VersionedGuest|null>;update:MutationAdapter<GuestFields>;guardians?:{options:()=>Promise<GuardianOption[]>;contact:(id:string)=>Promise<string>;allowNew:()=>boolean}};
const empty=(center:string):BoRecord=>({id:"",category:"",name:"",gender:"",phone:"",birthDate:"",email:"",note:"",center,createdAt:null,createdBy:null,updatedAt:null,updatedBy:null});
const editableKeys=["name","gender","phone","birthDate","email","note"] as const;
export function BoMyTimeGuests({context,centerLabel,initialRows,port,binding,canCreate,canCreateNow,guardianPreview}:{context:AuthorizationContext;centerLabel:string;initialRows:readonly VersionedGuest[];port:GuestPort;binding?:{registry:TddRegistry;schema:ModuleSchema<GuestFields>};canCreate?:boolean;canCreateNow?:()=>boolean;guardianPreview?:{options:readonly GuardianOption[];initial:Readonly<Record<string,GuardianDraft>>}}){
 const activeRegistry=binding?.registry??registry,activeSchema=binding?.schema??guestSchema;
 const menu=useContext(TddHostMenu);
 const [rows,setRows]=useState(initialRows);
 const navigation=useMemo(()=>binding?browserTddNavigation("BO","mytime-guests",queryDefault):null,[binding]);
 const [query,setQuery]=useState<TableQuery<GuestFields>>(()=>navigation?.read().query??queryDefault);
 const preview=guardianPreview&&!binding?guardianPreview:null;
 const [lookupOptions,setLookupOptions]=useState<GuardianOption[]>([]),[lookupBusy,setLookupBusy]=useState(false);
 const lookupEpoch=useRef(0);
 const guardianOptions=preview?.options??lookupOptions;
 const [guardianDraft,setGuardianDraft]=useState<GuardianDraft>(blankGuardian);
 const [guardianById,setGuardianById]=useState<Record<string,GuardianDraft>>(()=>({...guardianPreview?.initial}));
 const [tab,setTab]=useState("overview");
 const [selected,setSelected]=useState<string|null>(null),[detail,setDetail]=useState(false);
 const [draft,setDraft]=useState<BoRecord|null>(null),[error,setError]=useState(""),[busy,setBusy]=useState(false);
 const attempt=useRef<{key:string;input:GuestCreateInput}|null>(null),inFlight=useRef(false);
 const [uncertain,setUncertain]=useState(false);
 useEffect(()=>{const epoch=++lookupEpoch.current;if(!port.guardians||guardianDraft.category!=="Trẻ em"||!draft){setLookupOptions([]);setLookupBusy(false);return;}setLookupBusy(true);port.guardians.options().then(result=>{if(epoch===lookupEpoch.current)setLookupOptions(result);}).catch(()=>{if(epoch===lookupEpoch.current){setLookupOptions([]);setError("Không thể tải danh sách người giám hộ được cấp quyền.");}}).finally(()=>{if(epoch===lookupEpoch.current)setLookupBusy(false);});return()=>{lookupEpoch.current++;};},[port,guardianDraft.category,!!draft]);
 const record=rows.find(x=>x.row.id===selected);
 const allowed=context.surface==="BO"&&context.authorize(activeSchema.capabilities.read),writable=allowed&&context.authorize(activeSchema.capabilities.edit??EDIT),creatable=allowed&&(canCreateNow?canCreateNow():canCreate??writable);
 const close=()=>{if(inFlight.current||uncertain)return;opening.current++;attempt.current=null;setDraft(null);setSelected(null);setDetail(false);setError("");if(navigation){navigation.change({kind:"table",tab:"overview",query});navigation.restore();}};
 const opening=useRef(0);
 const open=async(id:string,toDetail=false)=>{const request=++opening.current;setSelected(null);setDetail(false);setDraft(null);setError("");try{if(port.read){const fresh=await port.read(id);if(request!==opening.current)return;if(!fresh){setError("Hồ sơ không còn được cấp quyền.");return;}setRows(old=>[...old.filter(x=>x.row.id!==id),fresh]);}setSelected(id);setDetail(toDetail);}catch{if(request===opening.current)setError("Không thể tải hồ sơ được cấp quyền.");}};
 useEffect(()=>{if(!navigation)return;const sync=()=>{if(attempt.current)return;const p=navigation.read();setQuery(p.query);setTab(p.tab);if(p.kind==="table"){opening.current++;setSelected(null);setDetail(false);}else if(p.recordId){void open(p.recordId,p.kind==="detail");}};sync();return navigation.subscribe(sync);},[navigation]);
 const updateDraft=(key:string,value:BoValue)=>{if(!creatable||uncertain||inFlight.current)return;if(key==="category"){const category=String(value??"");setGuardianDraft(old=>category==="Trẻ em"?{...old,category}:{...blankGuardian(),category});setError("");return;}if(!editableKeys.some(k=>k===key))return;setDraft(old=>old?{...old,[key]:value}:old);setError("");};
 const submit=async()=>{
  if(!draft||!creatable||inFlight.current||lookupBusy)return;
  const selectedParent=guardianOptions.find(x=>x.label===guardianDraft.guardianSource)?.id;
  const input={...Object.fromEntries(editableKeys.map(k=>[k,String(draft[k]??"").trim()])),category:guardianDraft.category,...(guardianDraft.category==="Trẻ em"?{guardianDraft,...(selectedParent?{guardianParentId:selectedParent}:{})}: {})} as GuestCreateInput;
  const issue=guardianIssue(guardianDraft,input.phone);if(issue){setError(issue);return;}
  const invalid=fields.filter(f=>editableKeys.some(k=>k===f.key)&&fieldValueErrors(f,input[f.key as keyof GuestCreateInput]).length);
  if(invalid.length){setError("Vui lòng kiểm tra: "+invalid.map(f=>f.label).join(", "));return;}
  const request=attempt.current??{key:preview&&!crypto.randomUUID?"preview-"+Array.from(crypto.getRandomValues(new Uint8Array(16)),x=>x.toString(16).padStart(2,"0")).join(""):crypto.randomUUID(),input};attempt.current=request;inFlight.current=true;setBusy(true);setError("");
  try{const created=await port.create(request.input,request.key);attempt.current=null;setUncertain(false);if(preview)setGuardianById(old=>({...old,[created.row.id]:guardianDraft}));setRows(old=>[...old.filter(x=>x.row.id!==created.row.id),created]);setSelected(created.row.id);setDraft(null);if(navigation)navigation.change({kind:"drawer",recordId:created.row.id,tab:"overview",query});}
  catch(e){if(e instanceof GuestParentCommitted){attempt.current=null;setUncertain(false);const parent=e.parent;setLookupOptions(old=>[...old.filter(o=>o.id!==parent.id),parent]);setGuardianDraft(old=>({...old,guardianSource:parent.label,guardianName:parent.name,guardianPhone:parent.phone}));setError(e.message);return;}const known=guestKnownFailure(e);if(known)attempt.current=null;setUncertain(!known&&!!binding);setError(known||!binding?(e instanceof Error?e.message:"Không thể tạo khách."):"Chưa xác nhận kết quả. Bấm tạo lại để kiểm tra cùng yêu cầu.");}
  finally{inFlight.current=false;setBusy(false);}
 };
 const displayGuardian=(row:GuestRow):GuardianDraft=>preview?(guardianById[row.id]??{...blankGuardian(),category:row.category??""}):({category:row.category??"",guardianSource:row.guardianName??"",guardianName:row.guardianName??"",guardianPhone:row.guardianPhone??"",guardianRelation:row.guardianRelation??""});
 const changeGuardian=(v:GuardianDraft)=>{setGuardianDraft(v);setError("");if(!port.guardians)return;const o=guardianOptions.find(x=>x.label===v.guardianSource);if(!o?.id||v.guardianSource===guardianDraft.guardianSource)return;const source=v.guardianSource,epoch=++lookupEpoch.current;setLookupBusy(true);void port.guardians.contact(o.id).then(phone=>{if(epoch===lookupEpoch.current)setGuardianDraft(old=>old.guardianSource===source?{...old,guardianPhone:phone}:old);}).catch(()=>{if(epoch===lookupEpoch.current){setGuardianDraft(old=>old.guardianSource===source?{...old,guardianPhone:""}:old);setError("Người giám hộ không có điện thoại hợp lệ hoặc ngoài phạm vi.");}}).finally(()=>{if(epoch===lookupEpoch.current)setLookupBusy(false);});};
 const save=(row:GuestRow,version:string)=>setRows(old=>old.map(x=>x.row.id===row.id?{row,version}:x));
 if(!allowed)return <RecordState status="denied"/>;
 return <TddPreferencePolicy.Provider value="ephemeral">
  {!draft&&error?<p role="alert">{error}</p>:null}
  <div hidden={detail}><TddRenderer view={{kind:"table",mobileMenu:menu("mytime-guests-menu"),headerActions:creatable?<button type="button" className="primary-btn" disabled={busy||uncertain||!!draft} onClick={()=>{if(inFlight.current||attempt.current||draft)return;opening.current++;setGuardianDraft(blankGuardian());setDraft(empty(centerLabel));setSelected(null);setError("");}}>Thêm khách</button>:null,props:{registry:activeRegistry,schema:binding?.schema??guestSchema,context,rows:rows.map(x=>x.row),query,status:"ready",onQueryChange:q=>{setQuery(q);if(navigation)navigation.change({...navigation.read(),query:q},true);},onOpen:r=>{if(inFlight.current||uncertain||draft)return;if(navigation){navigation.capture(r.id);navigation.change({kind:"drawer",recordId:r.id,tab:"overview",query});}else void open(r.id);}}}}/></div>
  {detail&&record?<TddDetail registry={activeRegistry} schema={activeSchema} context={context} record={record.row} subject={{type:"mytime_guest",id:record.row.id}} mobileMenu={menu("mytime-detail-menu")} activeTab={tab} onTabChange={v=>{setTab(v);if(navigation&&record)navigation.change({kind:"detail",recordId:record.row.id,tab:v,query},true);}} onBack={close} overviewAfter={<GuardianPreview value={displayGuardian(record.row)} options={[]} variant="detail" editable={false} onChange={()=>{}}/>} writes={writable?{adapter:port.update,version:record.version,onSaved:save}:undefined}/>:null}
  {draft||record&&!detail?<BoQuickView key={draft?"create":record!.row.id} module={guestModule} moduleKey="mytime-guests" extraSection={<GuardianPreview key={draft?"new":record?.row.id} value={draft?guardianDraft:displayGuardian(record!.row)} options={guardianOptions} allowNew={preview?true:port.guardians?.allowNew()??false} variant="drawer" editable={!!draft&&creatable&&!busy&&!uncertain&&!lookupBusy} onChange={changeGuardian}/>} record={draft?null:{...record!.row,name:String(record!.row.name??""),...(preview?{category:guardianById[record!.row.id]?.category??record!.row.category}:{})}} onClose={close} onDetail={()=>{if(record&&navigation)navigation.change({kind:"detail",recordId:record.row.id,tab:"overview",query});else setDetail(true);}}
    create={draft?{draft:{...draft,category:guardianDraft.category},editable:f=>creatable&&!busy&&!uncertain&&(f.key==="category"||editableKeys.some(k=>k===f.key)),editorField:f=>({...f,readonly:false}),onChange:updateDraft,onCreate:submit,busy:busy||lookupBusy,error,title:"Thêm khách",path:"Khách"}:undefined}/>:null}
 </TddPreferencePolicy.Provider>;
}
