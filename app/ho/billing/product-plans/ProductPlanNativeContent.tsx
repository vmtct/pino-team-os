"use client";
import "@pino/design-system/bo-tokens.css";
// PAP-2365 / PLT-PRODUCT-PLAN — same approved renderer, real data only.
import {useCallback,useContext,useEffect,useMemo,useRef,useState} from "react";
import {TddRenderer} from "@/app/components/workspace-renderer/Renderer";
import {BusinessDataGrid,type SlotLoaders} from "@/app/components/workspace-renderer/Slots";
import {TddHostMenu} from "@/app/components/workspace-adapters/SurfaceWorkspace";
import {TddPreferencePolicy} from "@/app/components/workspace-renderer/Record";
import {useResource} from "@/app/components/workspace-renderer/useResource";
import {loadHistory,type ModuleSchema,type AuthorizationContext,type MutationAdapter,type TableQuery} from "@/lib/workspace-schema";
import {HistoryState} from "@/app/components/workspace-renderer/History";
import {planQuery,PLAN_READ,PLAN_EDIT,type PlanFields} from "./schema";
import {createPlanContext,nativePlanRegistry,nativePlanSchema,nativePlanUrl,parseNativePlanQuery,type PlanTab,type PlanClient} from "./product-plan-native-binding";
import {createProductPlanClient,CatalogRequestError,isPlanId} from "./product-plan-native-contract";
import {createPlanBrowserPort} from "./product-plan-http-contract";
import {createCatalogJournal} from "./product-plan-pending-journal";
const directFields=["name","cadence","termWeeks","price","badge","enabled"] as const;
type Subscription=Awaited<ReturnType<PlanClient["subscriptions"]>>["items"][number];
const date=(x:string|null)=>x?x.split("-").reverse().join("/"):"—";
const columns=[
 {key:"id",header:"Subscription ID",render:(r:Subscription)=>r.id,minWidth:190},
 {key:"student",header:"Học viên",render:(r:Subscription)=>r.student,minWidth:135},
 {key:"center",header:"Center",render:(r:Subscription)=>r.center,minWidth:125},
 {key:"status",header:"Trạng thái",render:(r:Subscription)=>r.status,minWidth:105},
 {key:"startsOn",header:"Bắt đầu",render:(r:Subscription)=>date(r.startsOn),minWidth:100},
 {key:"endsOn",header:"Kết thúc",render:(r:Subscription)=>date(r.endsOn),minWidth:100},
 {key:"createdAt",header:"Created Time",render:(r:Subscription)=>r.createdAt,minWidth:145},
 {key:"createdBy",header:"Created By",render:(r:Subscription)=>r.createdBy,minWidth:145},
 {key:"updatedAt",header:"Last Modified Time",render:(r:Subscription)=>r.updatedAt,minWidth:145},
 {key:"updatedBy",header:"Last Modified By",render:(r:Subscription)=>r.updatedBy,minWidth:145},
];
function ProductPlanHistory({schema,context,id}:{schema:ModuleSchema;context:AuthorizationContext;id:string}){
 const [cursor,setCursor]=useState<string|null>(null);
 const load=useCallback((signal:AbortSignal)=>loadHistory(schema,{type:"product_plan",id},context,signal,cursor),[schema,context,id,cursor]);
 const {result,retry}=useResource(load);
 if(result.status==="loading")return <p role="status">Đang tải lịch sử…</p>;
 if(result.status==="error")return <p role="alert">Không thể tải lịch sử. <button type="button" className="secondary-btn" onClick={retry}>Thử lại</button></p>;
 const value=result.value;
 return <><HistoryState value={value} fields={schema.fields}/>
 {value.status==="authorized"&&cursor?<button type="button" className="secondary-btn" onClick={()=>setCursor(null)}>Trang lịch sử đầu</button>:null}
 {value.status==="authorized"&&value.nextCursor?<button type="button" className="secondary-btn" onClick={()=>setCursor(value.nextCursor)}>Trang lịch sử tiếp</button>:null}</>;
}
export function ProductPlanNativeWorkspace({client,permissionKeys,initialRecord,initialTab="overview"}:{client:PlanClient;permissionKeys:readonly string[];initialRecord?:string;initialTab?:PlanTab}){
 const menu=useContext(TddHostMenu);
 const context=useMemo(()=>createPlanContext(client,key=>permissionKeys.includes(key)),[client,permissionKeys]);
 const schema=nativePlanSchema;
 const [query,setQuery]=useState<TableQuery<PlanFields>>(planQuery);
 const [selected,setSelected]=useState<string|null>(initialRecord??null),[full,setFull]=useState(Boolean(initialRecord)),[tab,setTab]=useState<PlanTab>(initialTab);
 const [revision,setRevision]=useState(0),[notice,setNotice]=useState(""),[recovering,setRecovering]=useState(false);
 const [fenced,setFenced]=useState(()=>{try{return client.pending()!==null;}catch{return true;}});
 const [relation,setRelation]=useState<{id:string;after:string|null}|null>(null);
 const lifetime=useRef<AbortController|null>(null);
 useEffect(()=>{const controller=new AbortController();lifetime.current=controller;return()=>{controller.abort();lifetime.current=null;};},[]);
 // Query changes are presentation-only: use a stable complete catalog load.
 const loadAll=useCallback(async(signal:AbortSignal)=>({...(await schema.data.list(planQuery,context,signal)),revision}),[schema,context,revision]);
 const {result,retry}=useResource(loadAll);
 const rows=result.status==="ready"&&result.value.revision===revision?result.value.rows:[];
 const loadDetail=useCallback(async(signal:AbortSignal)=>({row:selected?await schema.data.detail(selected,context,signal):null,revision}),[schema,context,selected,revision]);
 const detail=useResource(loadDetail);
 const row=detail.result.status==="ready"&&detail.result.value.revision===revision?detail.result.value.row:null;
 const refresh=useCallback(()=>setRevision(n=>n+1),[]);
 const onSaved=useCallback(()=>refresh(),[refresh]);
 const recover=async()=>{
 if(recovering||!lifetime.current)return;
 setRecovering(true);
 try{const outcome=await client.recover(lifetime.current.signal);
 if(outcome.status==="pending"){setFenced(true);setNotice("Chưa xác minh được kết quả lưu. Chỉ có thể kiểm tra lại.");}
 else{setFenced(false);setNotice(outcome.status==="version-advanced"?"Phiên bản đã thay đổi. Đã tải lại dữ liệu; kết quả yêu cầu trước chưa được xác nhận.":"Đã kiểm tra dữ liệu.");refresh();}
 }catch{setFenced(true);setNotice("Không thể xác minh kết quả lưu. Không gửi lại yêu cầu.");}
 finally{setRecovering(false);}
 };
 const adapter=useMemo<MutationAdapter<PlanFields>>(()=>({update:async(id,patch,version,authorization,signal)=>{
 if(authorization!==context||!context.authorize(PLAN_READ)||!context.authorize(PLAN_EDIT)||!lifetime.current)return {status:"denied"};
 try{
 const saved=await client.update(id,patch,version,AbortSignal.any([signal,lifetime.current.signal]));
 return {status:"saved",row:saved,version:String(saved.version)};
 }catch(e){
 if(e instanceof CatalogRequestError){
 if(e.status===409){setNotice("Bản ghi đã thay đổi. Đang tải lại dữ liệu.");refresh();return {status:"conflict"};}
 if(e.status===401||e.status===403||e.status===404){setNotice("Phiên làm việc hoặc quyền truy cập đã thay đổi.");refresh();return {status:"denied"};}
 if(e.status===400||e.status===422)return {status:"invalid",fields:[...directFields]};
 }
 try{setFenced(client.pending()!==null);}catch{setFenced(true);}
 setNotice("Chưa xác minh được kết quả lưu. Kiểm tra lại trước khi sửa.");throw e;
 }
 }}),[client,context,refresh]);
 const loaders=useMemo<SlotLoaders>(()=>({"product-plan-subscriptions-native":async(slot,record,authorization,signal)=>{
 if(authorization!==context||!context.authorize(PLAN_READ)||slot.id!=="subscriptions"||!isPlanId(record.id))return <p role="status">Không có quyền xem nội dung.</p>;
 const after=relation?.id===record.id?relation.after:null;
 const page=await client.subscriptions(record.id,signal,after);
 return <><BusinessDataGrid caption="Subscription" rows={page.items} columns={columns} rowKey={r=>r.id} showToolbar={false} emptyTitle="Chưa có Subscription" emptyMessage="Chưa có Subscription sử dụng gói học này." />
 {after?<button type="button" className="secondary-btn" onClick={()=>setRelation({id:record.id,after:null})}>Trang đầu</button>:null}
 {page.nextAfter?<button type="button" className="secondary-btn" onClick={()=>setRelation({id:record.id,after:page.nextAfter})}>Trang tiếp</button>:null}</>;
 }}),[client,context,relation]);
 const navigate=(id:string|null,next:PlanTab="overview")=>{const target=nativePlanUrl(id,next);if(location.pathname+location.search!==target)history.pushState(null,"",target);};
 useEffect(()=>{const restore=()=>{const state=parseNativePlanQuery(new URLSearchParams(location.search));setSelected(state?.record??null);setFull(Boolean(state?.record));setTab(state?.tab??"overview");setRelation(null);};addEventListener("popstate",restore);return()=>removeEventListener("popstate",restore);},[]);
 const close=()=>{navigate(null);setSelected(null);setFull(false);setTab("overview");setRelation(null);};
 const canEdit=context.authorize(PLAN_READ)&&context.authorize(PLAN_EDIT)&&!fenced&&result.status==="ready";
 const tableWrites=canEdit?{adapter,versionForRow:(id:string)=>String(rows.find(r=>r.id===id)?.version??""),onSaved}:undefined;
 const recordWrites=canEdit&&row?{adapter,version:String(row.version),onSaved,directFields}:undefined;
 const common={registry:nativePlanRegistry,context};
 if(!context.authorize(PLAN_READ))return <p role="alert">Không có quyền truy cập gói học.</p>;
 return <TddPreferencePolicy.Provider value="ephemeral">
 {notice||fenced?<div role="status">{notice||"Có yêu cầu lưu chưa xác minh."} {fenced?<button type="button" className="secondary-btn" disabled={recovering} onClick={()=>void recover()}>Kiểm tra lại</button>:null}</div>:null}
 {full&&row?<TddRenderer view={{kind:"detail",props:{...common,schema:nativePlanSchema,record:row,writes:recordWrites,loaders,subject:{type:"product_plan",id:row.id},historyContent:<ProductPlanHistory key={row.id+":"+String(row.version)} schema={schema as unknown as ModuleSchema} context={context} id={row.id}/>,mobileMenu:menu("detail-menu-btn"),onBack:close,activeTab:tab,onTabChange:id=>{if(id==="overview"||id==="subscriptions"||id==="history"){setTab(id);navigate(row.id,id);}}}}}/>:
 <TddRenderer view={{kind:"table",mobileMenu:menu("menu-btn"),props:{...common,schema:nativePlanSchema,query,rows,total:rows.length,status:result.status,onRetry:retry,writes:tableWrites,onQueryChange:setQuery,onOpen:r=>{setSelected(r.id);setFull(false);setRelation(null);}}}}/>}
 {selected&&!row?<p role={detail.result.status==="error"?"alert":"status"}>{detail.result.status==="loading"?"Đang tải gói học…":"Không thể tải gói học."} <button type="button" className="secondary-btn" onClick={detail.retry}>Thử lại</button> <button type="button" className="secondary-btn" onClick={close}>Đóng</button></p>:null}
 {row&&!full?<TddRenderer view={{kind:"drawer",props:{...common,schema:nativePlanSchema,record:row,writes:recordWrites,onClose:close,onDetail:()=>{navigate(row.id);setTab("overview");setFull(true);}}}}/>:null}
 </TddPreferencePolicy.Provider>;
}
export function ProductPlanNativeEntry({actorId,permissionKeys,initialRecord,initialTab}:{actorId:string;permissionKeys:readonly string[];initialRecord?:string;initialTab?:PlanTab}){
 const load=useCallback(async(signal:AbortSignal)=>{signal.throwIfAborted();const client=createProductPlanClient(createPlanBrowserPort(actorId,location.origin),createCatalogJournal(sessionStorage,"pino:ho:product-plans:"+actorId),actorId);return client;},[actorId]);
 const {result,retry}=useResource(load);
 if(result.status==="loading")return <p role="status">Đang tải gói học…</p>;
 if(result.status==="error")return <p role="alert">Không thể mở gói học. <button type="button" className="secondary-btn" onClick={retry}>Thử lại</button></p>;
 return <ProductPlanNativeWorkspace key={actorId} client={result.value} permissionKeys={permissionKeys} initialRecord={initialRecord} initialTab={initialTab}/>;
}
