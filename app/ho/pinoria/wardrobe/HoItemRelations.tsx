"use client";
import {useCallback,useEffect,useMemo,useState} from "react";
import {assetUrl,getItem,listItems,slotNames,writeItem,type HoItem,type HoSetItem,type ItemRecord,type SetInput,type Slot} from "./item-client";
import "@/app/components/pinoria-item/item-calibration.css";
type RelationsProps={itemId:string;canManage:boolean};
const stack:Record<Slot,number>={AURA_GROUND:6,AURA_BACK:12,BACK:30,OUTFIT:60,HAIR:70,FACE:80,HEADWEAR:90,PATH_MARK:100};
const base="https://assets.pinohouse.art/pinoria/char-base.png";
const message=(e:unknown)=>e instanceof Error?e.message:"Không thể lưu. Tải lại để kiểm tra dữ liệu.";
const isWearable=(r:ItemRecord):r is HoItem=>r.type!=="SET";
const variant=(r:ItemRecord)=>r.pendingDraft?.variantOfItemId??r.variantOfItemId??"";
function setShape(r:HoSetItem):SetInput{
 return {type:"SET",key:r.key,displayName:r.displayName,
  starterEligible:r.pendingDraft?.starterEligible??r.starterEligible??false,
  memberItemIds:r.pendingDraft?.memberItemIds??r.members?.map(m=>m.id)??[],
  variantOfItemId:r.pendingDraft?.variantOfItemId??r.variantOfItemId??null};
}
function variantShape(r:ItemRecord,target:string){
 if(r.type==="SET")return {...setShape(r),variantOfItemId:target||null,expectedRevision:r.revision};
 const source=r.pendingDraft??r;
 return {key:source.key,displayName:source.displayName,type:source.type,slot:source.slot,asset:source.asset,
  positionX:source.positionX,positionY:source.positionY,scale:source.scale,rotationDegrees:source.rotationDegrees,
  variantOfItemId:target||null,expectedRevision:r.revision};
}
function useRelations(itemId:string){
 const [item,setItem]=useState<ItemRecord|null>(null);
 const [items,setItems]=useState<ItemRecord[]>([]);
 const [loading,setLoading]=useState(true),[busy,setBusy]=useState(false);
 const [error,setError]=useState(""),[notice,setNotice]=useState("");
 const refresh=useCallback(async ()=>{
  const [fresh,list]=await Promise.all([getItem(itemId),listItems()]);
  setItem(fresh);setItems(list);setError("");setLoading(false);
  return fresh;
 },[itemId]);
 useEffect(()=>{
  let active=true;const ctrl=new AbortController();
  Promise.all([getItem(itemId,ctrl.signal),listItems(ctrl.signal)])
   .then(([fresh,list])=>{if(active){setItem(fresh);setItems(list);setLoading(false)}})
   .catch(err=>{if(active){setError(message(err));setLoading(false)}});
  return ()=>{active=false;ctrl.abort()};
 },[itemId]);
 const mutate=async (path:string,body:object,label:string)=>{
  if(!item||busy)return;
  const previous=item.revision;setBusy(true);setNotice("");setError("");
  try{
   await writeItem(path,"PATCH",body);
   const verified=await refresh();
   if(verified.revision<=previous)throw Error("Chưa xác minh được revision mới. Tải lại trước khi thử lại.");
   setNotice(label+" đã lưu, revision "+verified.revision+".");
  }catch(e){setError(message(e))}finally{setBusy(false)}
 };
 const publish=async()=>{
  if(!item||busy)return;
  const previous=item.revision;setBusy(true);setError("");setNotice("");
  try{
   const response=await fetch("/api/ho/pinoria/items/"+item.id+"/publish",{
    method:"POST",cache:"no-store",credentials:"same-origin",
    headers:{"content-type":"application/json","idempotency-key":crypto.randomUUID()},
    body:JSON.stringify({expectedRevision:previous})
   });
   if(!response.ok){
    if(response.status===409)throw Error("Revision đã thay đổi. Tải lại và kiểm tra trước khi Publish.");
    if(response.status===403)throw Error("Không có quyền Publish.");
    const payload=await response.json().catch(()=>null) as {error?:{message?:string}}|null;
    throw Error(payload?.error?.message||"Không thể Publish ("+response.status+").");
   }
   const verified=await refresh();
   if(verified.status!=="PUBLISHED"||verified.revision<=previous||verified.pendingDraft)
    throw Error("Không xác minh được Published revision mới.");
   setNotice("Đã xác minh Published revision "+verified.revision+".");
  }catch(e){setError(message(e))}finally{setBusy(false)}
 };
 const feedback=<>{loading?<p role="status">Đang tải Item từ Core…</p>:null}
  {error?<p role="alert" className="pino-rel-error">{error}</p>:null}
  {notice?<p role="status" className="pino-rel-notice">{notice}</p>:null}</>;
 return {item,items,loading,busy,error,setError,notice,setNotice,refresh,mutate,publish,feedback};
}
function PublishControl({item,busy,publish}:{item:ItemRecord;busy:boolean;publish:()=>Promise<void>}){
 const allowed=item.status==="DRAFT"||(item.status==="PUBLISHED"&&Boolean(item.pendingDraft));
 return allowed?<button className="secondary-btn" type="button" disabled={busy} onClick={()=>void publish()}>{item.status==="PUBLISHED"?"Publish revision":"Publish"}</button>:null;
}
export function HoItemVariants({itemId,canManage}:RelationsProps){
 const state=useRelations(itemId);
 const {item,items,busy,error,setError,setNotice,refresh,mutate,publish,feedback}=state;
 const [choice,setChoice]=useState("");
 useEffect(()=>{if(item)setChoice(variant(item))},[item]);
 if(!item)return <section className="ho-item-relations">{feedback}</section>;
 const eligible=items.filter(other=>other.id!==item.id&&other.type===item.type&&
  (item.type==="SET"||other.slot===item.slot));
 const roots=items.filter(other=>variant(other)===item.id);
 return <section className="ho-item-relations" aria-label="Biến thể Item">
  <h3>Biến thể / Related Items</h3>
  <p>Mỗi Item có ảnh, Calibration, trạng thái Publish độc lập. Liên kết chỉ tham chiếu Item gốc.</p>
  <label>Variant of
   <select aria-label="Variant of" disabled={!canManage||busy||item.status==="UNPUBLISHED"} value={choice} onChange={e=>{setChoice(e.target.value);setNotice("");setError("")}}>
    <option value="">— Không liên kết —</option>
    {eligible.map(other=><option key={other.id} value={other.id}>{other.displayName} · {other.key}</option>)}
   </select>
  </label>
  <div className="ho-rel-actions">
   <button className="primary-btn" type="button" disabled={!canManage||busy||item.status==="UNPUBLISHED"||choice===variant(item)}
     onClick={()=>void mutate("/"+item.id,variantShape(item,choice),"Biến thể")}>{busy?"Đang lưu…":"Lưu liên kết"}</button>
   <PublishControl item={item} busy={busy} publish={publish}/>
   <button type="button" className="secondary-btn" disabled={busy} onClick={()=>void refresh().catch(e=>setError(message(e)))}>Tải lại</button>
  </div>
  {item.status==="PUBLISHED"&&item.pendingDraft?<p className="ho-rel-warning">Liên kết đang ở bản nháp; chỉ Publish revision mới thay đổi bản công bố.</p>:null}
  <h4>Biến thể tham chiếu Item này</h4>
  {roots.length?<ul>{roots.map(x=><li key={x.id}>{x.displayName} · {x.key}</li>)}</ul>:<p>Chưa có biến thể liên kết.</p>}
  {feedback}
 </section>;
}
export function HoItemMembers({itemId,canManage}:RelationsProps){
 const state=useRelations(itemId);
 const {item,items,busy,setError,setNotice,refresh,mutate,publish,feedback}=state;
 const [members,setMembers]=useState<string[]>([]),[starter,setStarter]=useState(false);
 useEffect(()=>{if(item?.type==="SET"){const shape=setShape(item);setMembers(shape.memberItemIds);setStarter(shape.starterEligible)}},[item]);
 const itemMap=useMemo(()=>new Map(items.map(i=>[i.id,i])),[items]);
 if(!item)return <section className="ho-item-relations">{feedback}</section>;
 if(item.type!=="SET")return <section className="ho-item-relations"><p role="status">Thành viên chỉ áp dụng cho Item loại SET.</p></section>;
 const current=setShape(item);
 const taken=new Set(members.map(id=>itemMap.get(id)?.slot).filter(Boolean));
 const available=items.filter(isWearable).filter(i=>i.status==="PUBLISHED"&&!members.includes(i.id));
 const valid=members.length>0&&members.length<=8&&members.every(id=>{const x=itemMap.get(id);return x&&x.type!=="SET"&&x.status==="PUBLISHED"&&x.slot})
  &&taken.size===members.length&&(!starter||(["HAIR","FACE","OUTFIT"] as Slot[]).every(s=>taken.has(s)));
 const changed=starter!==current.starterEligible||JSON.stringify(members)!==JSON.stringify(current.memberItemIds);
 const edit=canManage&&!busy&&item.status!=="UNPUBLISHED";
 const move=(idx:number,offset:number)=>{const target=idx+offset;if(target<0||target>=members.length)return;const next=[...members];[next[idx],next[target]]=[next[target],next[idx]];setMembers(next);setNotice("")};
 const remove=(id:string)=>{setMembers(v=>v.filter(x=>x!==id));setNotice("")};
 const preview=members.map(id=>itemMap.get(id)).filter((v):v is HoItem=>Boolean(v&&v.type!=="SET")).sort((a,b)=>stack[a.slot]-stack[b.slot]);
 return <section className="ho-item-relations" aria-label="Thành viên Set">
  <h3>Thành viên Set</h3>
  <p>Thành viên tham chiếu Item đã Publish. Không trùng Slot, không SET lồng SET; thứ tự thành viên được lưu cùng revision.</p>
  <label className="ho-rel-check"><input type="checkbox" disabled={!edit} checked={starter} onChange={e=>{setStarter(e.target.checked);setNotice("")}}/> Starter Set (cần Tóc, Khuôn mặt, Trang phục)</label>
  <label>Thêm Item đã Publish
   <select aria-label="Chọn Item vào Set" disabled={!edit||members.length>=8} value="" onChange={e=>{const x=itemMap.get(e.target.value);if(!x||x.type==="SET"||taken.has(x.slot))return;setMembers(v=>[...v,x.id]);setNotice("")}}>
    <option value="">— Chọn Item —</option>
    {available.map(x=><option key={x.id} value={x.id} disabled={taken.has(x.slot)}>{x.displayName} · {slotNames[x.slot]}{taken.has(x.slot)?" (Slot đã có)":""}</option>)}
   </select>
  </label>
  <h4>Danh sách có thứ tự · {members.length} Item</h4>
  <div className="ho-rel-members">
   {members.map((id,index)=>{const x=itemMap.get(id);return <div className="ho-rel-member" key={id}>
    <strong>{index+1}</strong><span>{x?.displayName??"Item không tồn tại"}</span><small>{x&&x.type!=="SET"?slotNames[x.slot]:"Không hợp lệ"}</small>
    <div className="ho-rel-member-actions">
     <button className="secondary-btn" type="button" aria-label={"Đưa Item "+(index+1)+" lên"} disabled={!edit||index===0} onClick={()=>move(index,-1)}>↑</button>
     <button className="secondary-btn" type="button" aria-label={"Đưa Item "+(index+1)+" xuống"} disabled={!edit||index===members.length-1} onClick={()=>move(index,1)}>↓</button>
     <button className="secondary-btn" type="button" disabled={!edit} onClick={()=>remove(id)}>Bỏ</button>
    </div>
   </div>})}
   {!members.length?<p>Chưa có thành viên.</p>:null}
  </div>
  {!valid&&members.length>0?<p role="alert">SET chưa hợp lệ: kiểm tra Slot, trạng thái Published và Starter Hair/Face/Outfit.</p>:null}
  <div className="ho-rel-actions">
   <button className="primary-btn" type="button" disabled={!edit||!valid||!changed} onClick={()=>void mutate("/"+item.id,{
    ...current,memberItemIds:members,starterEligible:starter,expectedRevision:item.revision
   },"Thành viên")}>{busy?"Đang lưu…":"Lưu thành viên"}</button>
   <PublishControl item={item} busy={busy} publish={publish}/>
   <button type="button" className="secondary-btn" disabled={busy} onClick={()=>void refresh().catch(e=>setError(message(e)))}>Tải lại</button>
  </div>
  {item.status==="PUBLISHED"&&item.pendingDraft?<p className="ho-rel-warning">Bản Published vẫn dùng thành viên cũ. Publish revision để áp dụng danh sách mới.</p>:null}
  <h3>Composition preview · 9:16</h3>
  <div className="ho-rel-stage" aria-label="Preview SET từ ảnh Item đã Publish">
   <img className="ho-rel-base" src={base} alt="Nhân vật nền Pinoria" />
   {preview.map(x=>{
    const url=assetUrl(x.asset,x.id);
    return url?<img key={x.id} className="ho-rel-layer" style={{
     zIndex:stack[x.slot],transform:"translate("+(x.positionX*100)+"%,"+(x.positionY*100)+"%) scale("+x.scale+") rotate("+(x.rotationDegrees??0)+"deg)"
    }} src={url+"?revision="+x.revision} alt={x.displayName}/>:null;
   })}
  </div>
  <p>Ảnh thành viên lấy từ R2 qua HO authenticated media. Nếu không có ảnh thật, không thay bằng hình giả.</p>
  {feedback}
 </section>;
}
