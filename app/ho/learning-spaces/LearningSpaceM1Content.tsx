"use client";
import "@pino/design-system/bo-tokens.css";
// PAP-2369 · Native shared TDD, isolated preview state. No network commands.
import { useCallback,useContext,useMemo,useRef,useState,useEffect } from "react";
import { TddRenderer } from "@/app/components/workspace-renderer/Renderer";
import { DrawerFrame } from "@/app/components/workspace-renderer/DrawerFrame";
import { PropertySections,type CreateDrawerField } from "@/app/components/workspace-renderer/Properties";
import { BusinessDataGrid,type SlotLoaders } from "@/app/components/workspace-renderer/Slots";
import { TddHostMenu } from "@/app/components/workspace-adapters/SurfaceWorkspace";
import { TddPreferencePolicy } from "@/app/components/workspace-renderer/Record";
import { toLegacyModule,allowsField,type AuthorizationContext,type ModuleSchema,type MutationAdapter,type TableQuery } from "@/lib/workspace-schema";
import { createPreviewState } from "@/lib/m1-preview/state";
import { useResource } from "@/app/components/workspace-renderer/useResource";
import {createLearningSpaceClient,SpaceApiError,type SpaceDto,type SpaceStatus} from "./learning-space-client";
import {createSpaceCommandFence,spaceAttemptStore,loadSpaceCenters,mergeSpacePatch,projectLiveSpace,type SpaceCommand,type CenterOption} from "./learning-space-provider";
import {createLiveSpaceSchema,loadSpaceClassRows} from "./learning-space-live-schema";
import { spaceM1,spaceStatuses,mockCenters,createSpace,updateSpace,deleteSpace,linkedClasses,type SpacePreview } from "./learning-space-m1-preview";
import { SPACE_READ,SPACE_EDIT,spaceRegistry,spaceSchema,spaceQuery,projectSpace,directFields,type SpaceSchemaFields } from "./schema";

type Draft={name:string;code:string;center:string;optimalCapacity:string;hardCapacity:string;status:string};
const emptyDraft=():Draft=>({name:"",code:"",center:"",optimalCapacity:"",hardCapacity:"",status:"ACTIVE"});
const relationColumns=[
 {key:"name",header:"Lớp học",render:(r:ReturnType<typeof linkedClasses>[number])=>r.name,minWidth:180},
 {key:"center",header:"Center",render:(r:ReturnType<typeof linkedClasses>[number])=>r.center,minWidth:130},
 {key:"status",header:"Trạng thái",render:(r:ReturnType<typeof linkedClasses>[number])=>r.status,minWidth:110},
 ...["Created Time","Created By","Last Modified Time","Last Modified By"].map((header,index)=>({key:["createdAt","createdBy","updatedAt","updatedBy"][index],header,render:()=>"—",minWidth:145}))
];
const loaders:SlotLoaders={"learning-space-classes-preview":async(slot,record,context,signal)=>{
 signal.throwIfAborted();
 if(context.surface!=="HO"||!context.authorize(SPACE_READ)||slot.id!=="runningClasses")return <p role="status">Không có quyền xem nội dung.</p>;
 return <BusinessDataGrid caption="Lớp học" rows={linkedClasses(record.id)} columns={relationColumns} rowKey={r=>r.id} showToolbar={false} emptyTitle="Chưa có lớp học" emptyMessage="Không có lớp học sử dụng không gian này." />;
}};
function SpaceCreateDrawer({context,onClose,onCreate,centers=mockCenters.map(c=>({id:c,name:c})),blocked=false}:{context:AuthorizationContext;onClose:()=>void;onCreate:(draft:Draft)=>string|null|Promise<string|null>;centers?:readonly CenterOption[];blocked?:boolean}){
 const [draft,setDraft]=useState(emptyDraft),[error,setError]=useState("");
 const change=(key:keyof Draft,value:string)=>{setDraft(d=>({...d,[key]:value}));setError("");};
 const fields=toLegacyModule(spaceSchema as unknown as ModuleSchema).fields.filter(field=>allowsField(spaceSchema,context,field.key,"display"));
 const sections=spaceSchema.drawer.sections.filter(s=>s.id!=="audit").map(s=>({...s,fields:s.fields.filter(k=>k!=="spaceId")}));
 const createFields:Record<string,CreateDrawerField>={};
 for(const key of Object.keys(draft) as (keyof Draft)[]){
  const id="space-create-"+key;

  createFields[key]={id,value:draft[key],onChange:v=>change(key,v),required:key!=="hardCapacity",
   ...(key==="center"?{control:<select id={id} className="property-control pds-direct-field" data-pino-ds="bo" data-pds-appearance="underline" value={draft[key]} onChange={e=>change(key,e.target.value)} required><option value="">— Chọn cơ sở —</option>{centers.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select>}:
    key==="status"?{control:<select id={id} className="property-control pds-direct-field" data-pino-ds="bo" data-pds-appearance="underline" value={draft[key]} onChange={e=>change(key,e.target.value)}>{spaceStatuses.map(s=><option key={s}>{s}</option>)}</select>}:
    key==="optimalCapacity"||key==="hardCapacity"?{control:<input id={id} className="property-control pds-direct-field" data-pino-ds="bo" data-pds-appearance="underline" value={draft[key]} onChange={e=>change(key,e.target.value)} type="number" min={1} step={1} required={key==="optimalCapacity"}/>}:
    {control:<input id={id} className="property-control pds-direct-field" data-pino-ds="bo" data-pds-appearance="underline" value={draft[key]} onChange={e=>change(key,e.target.value)} type="text" required maxLength={key==="name"?200:64}/>})};
 }
 return <DrawerFrame title="Tạo không gian học" path={spaceSchema.label} onClose={onClose} footer={<><button type="button" className="secondary-btn" onClick={onClose}>Hủy</button><button type="button" className="primary-btn" disabled={blocked} onClick={async()=>{const message=await onCreate(draft);if(message)setError(message);}}>＋ Tạo không gian học</button></>}>
 <PropertySections variant="drawer" fields={fields} record={{id:"",name:draft.name}} sections={sections} createFields={createFields}/>
 {error&&<p role="alert" className="edit-error">{error}</p>}
 </DrawerFrame>;
}
export function LearningSpaceM1Content({scopeKey,permissionKeys,initialRecord,liveReadOnly=false,liveWrites=false}:{scopeKey:string;permissionKeys:readonly string[];initialRecord?:string;liveReadOnly?:boolean;liveWrites?:boolean}){
 const menu=useContext(TddHostMenu);
 const context=useMemo<AuthorizationContext>(()=>({surface:"HO",authorize:key=>permissionKeys.includes(key)}),[permissionKeys]);
 const [state,setState]=useState(()=>createPreviewState(spaceM1,scopeKey));
 const current=useRef(state);
 const [query,setQuery]=useState<TableQuery<SpaceSchemaFields>>(spaceQuery);
 const [selected,setSelected]=useState<string|null>(initialRecord??null),[full,setFull]=useState(Boolean(initialRecord)),[creating,setCreating]=useState(false);
 const [confirm,setConfirm]=useState(false),[notice,setNotice]=useState("");
 const previewRow=state.records.find(r=>r.id===selected);
 const client=useMemo(()=>createLearningSpaceClient(),[]);
 const live=useMemo(()=>createLiveSpaceSchema(client),[client]);
 const readList=useCallback((signal:AbortSignal)=>liveReadOnly&&context.authorize(SPACE_READ)?live.schema.data.list(spaceQuery,context,signal):Promise.resolve({rows:[],total:0}),[liveReadOnly,context,live]);
 const listResource=useResource(readList);
 const readDetail=useCallback(async(signal:AbortSignal)=>{if(!liveReadOnly||!selected||!context.authorize(SPACE_READ))return null;try{return await client.detail(selected,signal);}catch(e){if(e instanceof SpaceApiError&&e.status===404)return null;throw e;}},[liveReadOnly,selected,context,client]);
 const detailResource=useResource(readDetail);
 const dto=detailResource.result.status==="ready"?detailResource.result.value:null;
 const row=liveReadOnly?(dto?{...dto,name:dto.displayName,hardCapacity:dto.hardConcurrentCapacity}:null):previewRow;
 const viewRow=liveReadOnly?(dto?projectLiveSpace(dto):null):previewRow?projectSpace(previewRow):null;
 const schema=liveReadOnly?live.schema:spaceSchema;
 const tableRows=liveReadOnly?(listResource.result.status==="ready"?listResource.result.value.rows:[]):state.records.map(projectSpace);
 const tableStatus=liveReadOnly?listResource.result.status:"ready";
 const slotLoaders=useMemo<SlotLoaders>(()=>liveReadOnly?{"learning-space-core-classes":async(slot,record,authorization,signal)=>{
  if(authorization.surface!=="HO"||!authorization.authorize(SPACE_READ)||slot.id!=="runningClasses")return <p role="status">Không có quyền xem nội dung.</p>;
  return <BusinessDataGrid caption="Lớp học" rows={await loadSpaceClassRows(client,record.id,signal)} columns={relationColumns} rowKey={r=>r.id} showToolbar={false} emptyTitle="Chưa có lớp học" emptyMessage="Không có lớp học sử dụng không gian này." />;
 }}:loaders,[client,liveReadOnly]);
 const canEdit=(!liveReadOnly||liveWrites)&&context.authorize(SPACE_READ)&&context.authorize(SPACE_EDIT);
 const fence=useMemo(()=>createSpaceCommandFence(client,undefined,liveReadOnly&&liveWrites&&typeof window!=="undefined"?spaceAttemptStore(scopeKey):undefined),[client,scopeKey,liveReadOnly,liveWrites]);
 const [commandState,setCommandState]=useState<"idle"|"pending"|"uncertain">(()=>fence.uncertain?"uncertain":"idle");
 const readCenters=useCallback((signal:AbortSignal)=>liveReadOnly&&liveWrites&&context.authorize(SPACE_EDIT)?loadSpaceCenters(fetch,signal):Promise.resolve([]),[liveReadOnly,liveWrites,context]);
 const centerResource=useResource(readCenters);
 const finishLive=(result:Awaited<ReturnType<typeof fence.submit>>)=>{
  setCommandState(fence.uncertain?"uncertain":"idle");
  if(result.status==="saved"){listResource.retry();detailResource.retry();setCreating(false);setConfirm(false);setNotice("");if(result.row===null){setSelected(null);setFull(false);const u=new URL(location.href);u.searchParams.delete("record");history.replaceState(null,"",u.pathname+u.search);}}
  else if(result.status==="conflict"){listResource.retry();detailResource.retry();setNotice("Dữ liệu đã thay đổi. Vui lòng kiểm tra lại.");}
  else setNotice(result.status==="uncertain"?"Chưa xác nhận được kết quả. Không gửi lệnh mới.":"Không thể lưu thay đổi.");
  return result;
 };
 const runLive=async(command:SpaceCommand)=>{
  if(!liveReadOnly||!liveWrites||!canEdit||fence.blocked)return {status:"busy" as const};
  setCommandState("pending");return finishLive(await fence.submit(command));
 };
 const retryLive=async()=>{if(!canEdit||!fence.uncertain)return;setCommandState("pending");finishLive(await fence.retry());};
 const getLive=async(id:string,version:string)=>{const record=await client.detail(id);if(String(record.version)!==version)throw Error("Version conflict");return record;};
 const adapter=useMemo<MutationAdapter<SpaceSchemaFields>>(()=>({update:async(id,patch,expectedVersion,authorization,signal)=>{
  signal.throwIfAborted();
  if(authorization.surface!=="HO"||!authorization.authorize(SPACE_EDIT))return {status:"denied"};
  const result=updateSpace(current.current,id,patch,Number(expectedVersion));
  if(result.status==="invalid")return {status:"invalid",fields:[...directFields]};
  if(result.status==="denied")return {status:"denied"};
  if(result.status!=="saved"||!result.record)return {status:"conflict"};
  current.current=result.state;setState(result.state);
  return {status:"saved",row:projectSpace(result.record),version:String(result.record.version)};
 }}),[]);
 const liveAdapter:MutationAdapter<SpaceSchemaFields>={update:async(id,patch,version,authorization,signal)=>{
  signal.throwIfAborted();if(authorization.surface!=="HO"||!authorization.authorize(SPACE_EDIT)||!canEdit||fence.blocked)return {status:"denied"};
  let record:SpaceDto;try{record=await getLive(id,version);}catch{return {status:"conflict"};}
  signal.throwIfAborted();let fields;try{fields=mergeSpacePatch(record,patch);}catch{return {status:"invalid",fields:[...directFields]};}
  const result=await runLive({kind:"update",id,version:record.version,fields});
  if(result.status==="saved"&&result.row)return {status:"saved",row:projectLiveSpace(result.row),version:String(result.row.version)};
  if(result.status==="invalid")return {status:"invalid",fields:[...directFields]};
  return {status:result.status==="denied"?"denied":"conflict"};
 }};
 const onSaved=()=>{};
 const common={registry:liveReadOnly?live.registry:spaceRegistry,context};
 const recordWrites=canEdit&&commandState==="idle"&&row?{adapter:liveReadOnly?liveAdapter:adapter,version:String(row.version),onSaved,directFields}:undefined;
 const tableWrites=canEdit&&commandState==="idle"?{adapter:liveReadOnly?liveAdapter:adapter,versionForRow:(id:string)=>String(tableRows.find(r=>r.id===id)?.version??""),onSaved}:undefined;
 const navigate=(id:string|null)=>{const url=new URL(location.href);if(id&&(liveReadOnly||id===spaceM1.seed.id))url.searchParams.set("record",id);else url.searchParams.delete("record");if(url.href!==location.href)history.pushState(null,"",url.pathname+url.search);};
 useEffect(()=>{const restore=()=>{const id=new URLSearchParams(location.search).get("record");setSelected(id);setFull(Boolean(id));setConfirm(false);};addEventListener("popstate",restore);return()=>removeEventListener("popstate",restore);},[]);
 const close=()=>{navigate(null);setSelected(null);setFull(false);setConfirm(false);setNotice("");};
 const submitCreate=async(draft:Draft)=>{if(!canEdit)return "Không có quyền.";if(liveReadOnly){if(centerResource.result.status!=="ready"||!centerResource.result.value.some(c=>c.id===draft.center))return "Chọn cơ sở hợp lệ.";const result=await runLive({kind:"create",fields:{centerId:draft.center,code:draft.code,displayName:draft.name,optimalConcurrentCapacity:Number(draft.optimalCapacity),hardConcurrentCapacity:draft.hardCapacity===""?null:Number(draft.hardCapacity),status:draft.status as SpaceStatus}});return result.status==="saved"?null:"Không thể xác nhận lưu.";}const r=createSpace(current.current,{...draft,optimalCapacity:Number(draft.optimalCapacity),hardCapacity:draft.hardCapacity===""?null:Number(draft.hardCapacity)});if(r.status!=="saved")return "Kiểm tra mã, cơ sở và sức chứa.";current.current=r.state;setState(r.state);setCreating(false);return null;};
 const clearHardCapacity=async(record:Pick<SpacePreview,"id"|"version">)=>{if(!canEdit)throw Error("Không có quyền.");if(liveReadOnly){const liveRecord=await getLive(record.id,String(record.version));const result=await runLive({kind:"update",id:liveRecord.id,version:liveRecord.version,fields:mergeSpacePatch(liveRecord,{hardCapacity:null})});if(result.status!=="saved")throw Error("Not saved");return;}const r=updateSpace(current.current,record.id,{hardCapacity:null},record.version);if(r.status!=="saved")throw Error("Không thể lưu giới hạn.");current.current=r.state;setState(r.state);};
 const deleteRow=async(record:Pick<SpacePreview,"id"|"version">)=>{if(!canEdit)return;if(liveReadOnly){try{const liveRecord=await getLive(record.id,String(record.version));if(liveRecord.referenceCount>0)throw Error("In use");await runLive({kind:"delete",id:liveRecord.id,version:liveRecord.version,centerId:liveRecord.centerId});}catch{setNotice("Không thể xóa không gian.");}return;}const r=deleteSpace(current.current,record.id,record.version);if(r.status!=="saved"){setNotice("Không thể xóa không gian đang được sử dụng.");setConfirm(false);return;}current.current=r.state;setState(r.state);close();};
 if(!context.authorize(SPACE_READ))return <p role="alert">Không có quyền truy cập không gian học.</p>;
 return <TddPreferencePolicy.Provider value="ephemeral">
 {full&&viewRow?<TddRenderer view={{kind:"detail",props:{...common,schema,record:viewRow,writes:recordWrites,loaders:slotLoaders,subject:{type:"learning_space",id:viewRow.id},mobileMenu:menu("detail-menu-btn"),onBack:close,overviewAfter:canEdit&&row?<section className="property-section"><h3>Vòng đời</h3>{row.hardCapacity!==null&&<button type="button" className="secondary-btn" disabled={commandState!=="idle"} onClick={async()=>{try{await clearHardCapacity(row);setNotice("");}catch{setNotice("Không thể lưu giới hạn.");}}}>Bỏ giới hạn tối đa</button>}{row.activeClassCount>0&&<p role="status">Không thể ngừng hoạt động hoặc lưu trữ khi có lớp đang hoạt động.</p>}<button type="button" className="secondary-btn" disabled={row.referenceCount>0||commandState!=="idle"} onClick={()=>setConfirm(true)}>Xóa không gian học</button>{confirm&&<div role="alertdialog" aria-label="Xác nhận xóa"><p>Xóa {row.name}?</p><button className="secondary-btn" onClick={()=>setConfirm(false)}>Hủy</button><button className="primary-btn" disabled={commandState!=="idle"} onClick={()=>void deleteRow(row)}>Xác nhận xóa</button></div>}{notice&&<p role="alert">{notice}</p>}</section>:undefined}}}/>:
 <TddRenderer view={{kind:"table",mobileMenu:menu("menu-btn"),headerActions:canEdit?<button disabled={commandState!=="idle"} type="button" className="primary-btn" onClick={()=>{close();setCreating(true);}}>＋ Tạo không gian học</button>:undefined,props:{...common,schema,query,rows:tableRows,total:tableRows.length,status:tableStatus,onRetry:listResource.retry,writes:tableWrites,onQueryChange:setQuery,onOpen:r=>{setSelected(r.id);setFull(false);}}}}/>}
 {viewRow&&!full&&<TddRenderer view={{kind:"drawer",props:{...common,schema,record:viewRow,writes:recordWrites,actions:canEdit&&row&&row.hardCapacity!==null?{"clear-hard-capacity":async(_record,authorization,signal)=>{signal.throwIfAborted();if(!authorization.authorize(SPACE_EDIT))throw Error("Denied");await clearHardCapacity(row);}}:undefined,onClose:close,onDetail:()=>{navigate(viewRow.id);setFull(true);}}}}/>}
  {creating&&canEdit&&<SpaceCreateDrawer context={context} onClose={()=>{if(!fence.blocked)setCreating(false);}} onCreate={submitCreate} centers={liveReadOnly?(centerResource.result.status==="ready"?centerResource.result.value:[]):undefined} blocked={commandState!=="idle"||(liveReadOnly&&centerResource.result.status!=="ready")}/>}
 {creating&&liveReadOnly&&centerResource.result.status==="error"&&<p role="alert">Không thể tải cơ sở. <button type="button" className="secondary-btn" onClick={centerResource.retry}>Thử lại</button></p>}
 {liveReadOnly&&commandState!=="idle"&&<section role="status">{commandState==="pending"?"Đang xác nhận thay đổi…":<><p role="alert">Chưa xác nhận kết quả. Không gửi lệnh mới.</p><button type="button" className="secondary-btn" onClick={()=>void retryLive()}>Kiểm tra lại cùng lệnh</button></>}</section>}
 {liveReadOnly&&notice&&<p role="alert">{notice}</p>}
  {selected&&!viewRow&&(liveReadOnly&&detailResource.result.status!=="ready"?<section role="status">{detailResource.result.status==="loading"?"Đang tải không gian học…":<><p role="alert">Không thể tải không gian học.</p><button type="button" className="secondary-btn" onClick={detailResource.retry}>Thử lại</button></>}</section>:<p role="alert">Không gian học không tồn tại.</p>)}
 </TddPreferencePolicy.Provider>;
}
