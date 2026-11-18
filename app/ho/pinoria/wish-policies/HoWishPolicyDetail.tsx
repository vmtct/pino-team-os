"use client";
/** PAP-2030 / PNR-WISH — native Detail, scoped draft save, no route/auth admission. */
import {useRef,useState,type ReactNode} from "react";
import wishActions from "./wish-detail-actions.module.css";
import type {WishDetailTab,WishRevisionRef} from "@/lib/pls-wish-detail-route";
import {DetailFrame} from "@/app/components/workspace-renderer/DetailFrame";
import {BoValue} from "@/app/bo/components/registration/BoValue";
import {BoTypedEditor} from "@/app/bo/components/registration/BoTypedEditor";
import type {BoField,BoValue as Value} from "@/lib/bo-registration";
import {confirmSavedWishDraft,type PolicyValue,type WishConfigHead} from "@/lib/pls-wish-ho-contract";
import {wishRevisionRef} from "./wish-catalog-state";
import {policyView,wishPolicyModule} from "./wish-policy-view";
import {policyEdit,policyCurve,policyEditCommand,policyEditCurrent,type PolicyEdit} from "./wish-policy-edit";
type Props={detailTab?:WishDetailTab;onDetailTab?:(tab:WishDetailTab)=>void;head:WishConfigHead<PolicyValue>;selection:"published"|"pending";centerLabel:string|null;onBack:()=>void;mobileMenu?:ReactNode;saveDraft?:(command:ReturnType<typeof policyEditCommand>)=>Promise<{receipt:unknown;readback:unknown}>;onSaved?:(next?:WishRevisionRef)=>void;revisionControl?:ReactNode;lifecycle?:ReactNode};
const editable:Record<string,keyof Omit<PolicyEdit,"curve"|"centerId"|"base">>={name:"name",plsPerWish:"cost",rate3:"rate3",rate4:"rate4",rate5:"rate5",hardPity4:"hard4",hardPity5:"hard5",softPityStart:"soft5",featuredGuarantee:"featured",media3:"media3",media4:"media4",media5:"media5"};
const groups=[{title:"Thông tin chính",keys:["name","version","status","center","plsPerWish"]},{title:"Rarity & pity",keys:["rate3","rate4","rate5","hardPity4","hardPity5","softPityStart","featuredGuarantee"]},{title:"Media",keys:["media3","media4","media5"]},{title:"Audit",keys:["createdAt","createdByUser","updatedAt","updatedByUser"]}];
export function HoWishPolicyDetail({head,selection,centerLabel,onBack,mobileMenu,saveDraft,onSaved,revisionControl,lifecycle,detailTab,onDetailTab}:Props){
 const v=policyView(head,selection,centerLabel);
 const [localTab,setLocalTab]=useState<WishDetailTab>("overview"),[draft,setDraft]=useState<PolicyEdit|null>(null),[error,setError]=useState(""),[busy,setBusy]=useState(false),[uncertain,setUncertain]=useState(false);
 const [editing,setEditing]=useState<{field:BoField;key:keyof Omit<PolicyEdit,"curve"|"centerId"|"base">;anchor:HTMLElement}|null>(null);
 const flight=useRef(false),tab=detailTab??localTab;
 function setTab(next:string){if(next!=="overview"&&next!=="history")return;if(flight.current||editing)return;setLocalTab(next);onDetailTab?.(next);}
 const conflicted=!!draft&&!policyEditCurrent(draft,head);
 const canEdit=!!saveDraft&&!!onSaved&&!head.staleDraft&&!uncertain&&!conflicted&&(selection==="pending"||!head.pendingDraft);
 const editBase=canEdit?(draft??policyEdit(head)):null;
 function change(key:keyof Omit<PolicyEdit,"curve"|"centerId"|"base">,value:Value){
  if(!editBase||busy||!canEdit)return;
  if(key==="name"&&typeof value!=="string")return;
  if(Object.is(editBase[key],value))return;
  const next={...editBase,[key]:value};
  if(key==="hard5"||key==="soft5"){try{next.curve=policyCurve(next);}catch{/* Invalid range is rejected by save. */}}
  setDraft(next);setError("");
 }
 async function submit(){
  if(!draft||!canEdit||!saveDraft||!onSaved||flight.current)return;
  let command:ReturnType<typeof policyEditCommand>;
  try{command=policyEditCommand(draft,head);}catch(e){setError(e instanceof Error?e.message:"Dữ liệu không hợp lệ.");return;}
  flight.current=true;setBusy(true);setError("");
  try{const r=await saveDraft(command);const next=confirmSavedWishDraft(command,r.receipt,r.readback);setDraft(null);onSaved(wishRevisionRef(next,"pending"));}
  catch(e){setUncertain(true);setError((e instanceof Error?e.message:"Không xác minh được bản nháp.")+" Tải lại dữ liệu trước khi thử lại.");}
  finally{flight.current=false;setBusy(false);}
 }
 const properties=(f:BoField)=>{const key=editable[f.key];const value=editBase&&key?editBase[key]:v.row[f.key];const active=!!editBase&&!!key&&!busy;
 return <div className="v24-prop-item" key={f.key}><div className="v24-prop-key"><span className="v24-field-glyph">{f.icon}</span>{f.label}</div>
 {active?<button type="button" className="v24-prop-value" aria-label={"Sửa "+f.label} onClick={e=>setEditing({field:{...f,readonly:false,type:f.key.startsWith("rate")?"text":f.type},key,anchor:e.currentTarget})}><BoValue field={f} value={value} full/></button>:<div className="v24-prop-value readonly" aria-label={"Chỉ đọc "+f.label}><BoValue field={f} value={value} full/></div>}</div>;};
 return <DetailFrame title={v.row.name} subtitle={v.row.id} onBack={()=>{if(!flight.current&&!draft&&!uncertain)onBack();}} mobileMenu={mobileMenu} tabs={[{id:"overview",label:"Tổng quan"},{id:"history",label:"Lịch sử"}]} selected={tab} onSelect={setTab}>
 {tab==="overview"?<>

 {draft&&<p role="status">Bản nháp riêng; phiên bản đã publish không thay đổi.</p>}
 <div className={wishActions.layout}><div className={wishActions.groups} data-wish-detail-groups>{groups.map(g=><section className="v24-prop-section" key={g.title}><div className="v24-section-heading"><h4>{g.title}</h4></div><div className={wishActions.propertyColumn}>{g.keys.map(k=>properties(wishPolicyModule.fields.find(f=>f.key===k)!))}</div></section>)}
 <section className={"v24-prop-section "+wishActions.curve} aria-label="Soft pity curve"><div className="v24-section-heading"><h4>Soft pity curve</h4></div><div className="table-scroll"><table className={wishActions.curveTable}><colgroup><col className={wishActions.wishColumn}/><col/></colgroup><thead><tr><th scope="col">Wish</th><th scope="col">5★ (%)</th></tr></thead><tbody>{(editBase?editBase.curve:v.curve).map(x=><tr key={x.position}><td>{x.position}</td><td>{editBase?<input className={"edit-input "+wishActions.curveInput} type="number" min={0} max={100} step="any" aria-label={"5★ (%) Wish "+x.position} disabled={busy||!canEdit} value={String(x.percentage??"")} onChange={e=>{const value=e.currentTarget.value;setDraft(d=>{const base=d??editBase;if(String(base.curve.find(p=>p.position===x.position)?.percentage)===value)return d;return {...base,curve:base.curve.map(p=>p.position===x.position?{...p,percentage:value}:p)};});setError("");}}/>:String(x.percentage)}</td></tr>)}</tbody></table></div></section></div></div>
 </>:<p role="status" className="v24-audit-empty">Lịch sử chi tiết chưa khả dụng.</p>}
 {conflicted&&<p role="alert">Cấu hình đã thay đổi. Hủy bản nháp cục bộ trước khi sửa lại.</p>}
 {error&&<p role="alert">{error}</p>}
 {!draft&&<div className={"heading-actions "+wishActions.row} data-wish-detail-actions>{revisionControl}{!uncertain&&lifecycle}</div>}
 {draft&&<div className={"heading-actions "+wishActions.row} data-wish-detail-actions>{uncertain&&<button type="button" className="primary-btn" disabled={busy} onClick={()=>onSaved?.()}>Tải lại để đối soát</button>}<button type="button" className="secondary-btn" disabled={busy} onClick={()=>{setDraft(null);setError("");setEditing(null);}}>Hủy</button><button type="button" className="primary-btn" disabled={busy||!canEdit} onClick={()=>void submit()}>{busy?"Đang lưu…":"Lưu bản nháp"}</button></div>}
 {editing&&editBase&&!busy&&canEdit&&<BoTypedEditor field={editing.field} value={editBase[editing.key]} anchor={editing.anchor} onClose={()=>setEditing(null)} onSave={value=>change(editing.key,value)}/>}

 </DetailFrame>;
}
