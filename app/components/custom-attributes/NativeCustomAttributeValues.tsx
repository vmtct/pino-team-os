"use client";
/** PAP-1671 / PLT-ATTR — native scoped controller. Reuse DS property rows and typed editor. */
import {useCallback,useEffect,useRef,useState} from "react";
import {createPortal} from "react-dom";
import {BoTypedEditor} from "@/app/bo/components/registration/BoTypedEditor";
import {CustomAttributeProperties} from "./CustomAttributeProperties";
import {attributeValueUrl,parseAttributePage,attributeValueCommand,parseAttributeReceipt,verifyAttributeReadback,type NativeAttributeEntity,type NativeAttributeValue} from "@/lib/bo-custom-attribute-client";
import type {AttributeEditPlan} from "@/lib/custom-attribute-projection";
import type {BoValue} from "@/lib/bo-registration";

type Props={entity:NativeAttributeEntity;entityId:string;centerId:string;variant:"drawer"|"detail"};
type Edit={item:NativeAttributeValue;plan:AttributeEditPlan;anchor:HTMLButtonElement};
class AttributeResponseError extends Error{constructor(public readonly status:number){super("Attribute request failed");}}
const explain=(e:unknown)=>e instanceof AttributeResponseError?
 e.status===401||e.status===403?"Bạn không có quyền truy cập thuộc tính tại cơ sở này.":
 e.status===404?"Hồ sơ hoặc thuộc tính không còn trong phạm vi.":
 e.status===409?"Dữ liệu đã thay đổi. Tải lại trước khi sửa.":
 e.status===422?"Giá trị không hợp lệ. Kiểm tra lại nội dung.":
 "Không thể xử lý thuộc tính. Vui lòng thử lại.":"Không thể xác minh dữ liệu thuộc tính.";

async function loadValues(p:Props,signal:AbortSignal):Promise<NativeAttributeValue[]>{
 const items:NativeAttributeValue[]=[];const seen=new Set<string>();let after:string|undefined;
 // Never silently truncate a result or follow a non-forward cursor.
 for(let page=0;page<100;page++){
  const response=await fetch(attributeValueUrl(p.entity,p.entityId,p.centerId,undefined,after),{cache:"no-store",signal,credentials:"same-origin"});
  if(!response.ok)throw new AttributeResponseError(response.status);
  const parsed=parseAttributePage(await response.json() as unknown,p.entity,p.centerId);
  for(const item of parsed.items){
   if(seen.has(item.id)||(after!==undefined&&item.id<=after))throw new Error("Invalid page");
   seen.add(item.id);items.push(item);
  }
  if(parsed.nextAfterDefinitionId===null)return items;
  if(after!==undefined&&parsed.nextAfterDefinitionId<=after)throw new Error("Invalid cursor");
  after=parsed.nextAfterDefinitionId;
 }
 throw new Error("Attribute page limit exceeded");
}
export function NativeCustomAttributeValues(p:Props){
 // Keyed inner controller prevents the old Center/entity's snapshot from ever rendering on a new target.
 return <ScopedValues key={p.entity+":"+p.entityId+":"+p.centerId+":"+p.variant} {...p}/>;
}
function ScopedValues({entity,entityId,centerId,variant}:Props){
 const [items,setItems]=useState<NativeAttributeValue[]|null>(null),[loading,setLoading]=useState(true);
 const [error,setError]=useState(""),[notice,setNotice]=useState(""),[edit,setEdit]=useState<Edit|null>(null),[busy,setBusy]=useState(false);
 const controller=useRef<AbortController|null>(null),saving=useRef(false);
 const closeEdit=useCallback(()=>setEdit(null),[]);
 const refresh=useCallback(async()=>{
  controller.current?.abort();const ctl=new AbortController();controller.current=ctl;
  setLoading(true);setItems(null);setError("");setEdit(null);
  try{const result=await loadValues({entity,entityId,centerId,variant},ctl.signal);if(!ctl.signal.aborted)setItems(result);}
  catch(e){if(!ctl.signal.aborted)setError(explain(e));}
  finally{if(!ctl.signal.aborted)setLoading(false);}
 },[entity,entityId,centerId,variant]);
 useEffect(()=>{let active=true;queueMicrotask(()=>{if(active)void refresh();});return()=>{active=false;controller.current?.abort();};},[refresh]);
 const save=async(draft:BoValue)=>{
  if(!edit||saving.current||loading)return;
  const parsed=edit.plan.parse(draft);if(!parsed.ok){setError(parsed.error);return;}
  const target=edit.item;const ctl=new AbortController();controller.current?.abort();controller.current=ctl;
  saving.current=true;setBusy(true);setError("");setNotice("");setEdit(null);
  let confirmed=false;
  try{
   const response=await fetch(attributeValueUrl(entity,entityId,centerId,target.id),{
    method:"PATCH",credentials:"same-origin",cache:"no-store",signal:ctl.signal,
    headers:{"content-type":"application/json"},body:JSON.stringify(attributeValueCommand(target,parsed.value)),
   });
   if(!response.ok)throw new AttributeResponseError(response.status);
   const receipt=parseAttributeReceipt(await response.json() as unknown,target);
   confirmed=true;
   if(ctl.signal.aborted)return;
   setItems(null);setLoading(true);
   const fresh=await loadValues({entity,entityId,centerId,variant},ctl.signal);
   verifyAttributeReadback(fresh,target,receipt,parsed.value);
   if(!ctl.signal.aborted){setItems(fresh);setNotice("Đã lưu thuộc tính.");}
  }catch(e){
   if(!ctl.signal.aborted){
    // Unknown/failed writes never retain a writable stale snapshot or silently replay.
    setItems(null);
    setError(confirmed?"Đã lưu, nhưng chưa xác minh được dữ liệu mới. Tải lại.":explain(e)+" Hãy tải lại để kiểm tra trước khi sửa.");
   }
  }finally{saving.current=false;if(!ctl.signal.aborted){setBusy(false);setLoading(false);}}
 };
 return <>
  {loading?<p role="status" className="settings-hint">Đang tải thuộc tính bổ sung…</p>:null}
  {error?<div role="alert" className="edit-error">{error} {!busy&&!edit?<button type="button" onClick={()=>{setNotice("");void refresh();}}>Tải lại</button>:null}</div>:null}
  {notice?<p role="status" className="settings-hint">{notice}</p>:null}
  {!loading&&items?<CustomAttributeProperties items={busy?items.map(x=>({...x,writable:false})):items} variant={variant}
   onEdit={busy?undefined:(field,anchor,plan)=>{const item=items.find(x=>"attribute:"+x.id===field.key);if(item?.writable){setError("");setNotice("");setEdit({item,anchor,plan});}}}/>:null}
  {edit?createPortal(<BoTypedEditor field={edit.plan.field} value={edit.plan.value} anchor={edit.anchor} onClose={closeEdit} closeOnSave={false}
   onSave={v=>{void save(v);}}/>,document.body):null}
 </>;
}