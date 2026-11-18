"use client";
/** PAP-2030 / PNR-WISH — structured banner draft fields and dedicated Item ledger controls. */
import {useState} from "react";
import wishActions from "../wish-policies/wish-detail-actions.module.css";
import {addBannerItem,changeBannerItem,removeBannerItem,wishLocalDate,wishUtcDate,type BannerEdit,type PublishedWishItem} from "./wish-banner-edit";
type Props={draft:BannerEdit;onChange:(d:BannerEdit)=>void;disabled:boolean;items:readonly PublishedWishItem[];centerLabels:Readonly<Record<string,string>>;onPreview?:(item:{itemId:string;revision:number})=>void};
export function BannerDraftOverview({draft,onChange,disabled,centerLabels}:Props){
 const v=draft.value;
 const update=(p:Partial<BannerEdit["value"]>)=>onChange({...draft,value:{...v,...p}});
 return <section className="v24-prop-section"><div className="v24-section-heading"><h4>Thông tin bản nháp</h4></div><div className="v24-prop-grid">
 <label className="v24-prop-item">Banner<input className="edit-input" maxLength={160} value={draft.name} disabled={disabled} onChange={e=>onChange({...draft,name:e.target.value})}/></label>
 <label className="v24-prop-item">Center scope<select className="edit-input" disabled={disabled} value={v.centerId??""} onChange={e=>update({centerId:e.target.value||null})}><option value="">Global</option>{v.centerId&&!Object.hasOwn(centerLabels,v.centerId)&&<option value={v.centerId}>— ({v.centerId})</option>}{Object.entries(centerLabels).map(([id,name])=><option value={id} key={id}>{name}</option>)}</select></label>
 <label className="v24-prop-item">Start (giờ Việt Nam)<input type="datetime-local" step="0.001" className="edit-input" disabled={disabled} value={wishLocalDate(v.startsAt)} onChange={e=>update({startsAt:wishUtcDate(e.target.value)})}/></label>
 <label className="v24-prop-item">End (giờ Việt Nam)<input type="datetime-local" step="0.001" className="edit-input" disabled={disabled} value={wishLocalDate(v.endsAt)} onChange={e=>update({endsAt:wishUtcDate(e.target.value)})}/></label>
 </div></section>;
}
export function BannerDraftItems({draft,onChange,disabled,items,onPreview}:Props){
 const [selected,setSelected]=useState(""),[error,setError]=useState("");
 const pool=draft.value.pool,max=Math.max(...pool.map(x=>x.weight)),total=pool.reduce((s,x)=>s+x.weight/max,0);
 function apply(fn:()=>BannerEdit){try{onChange(fn());setError("");}catch(e){setError(e instanceof Error?e.message:"Item không hợp lệ.");}}
 return <section className="v24-prop-section" aria-label="Item ledger edit"><p className="settings-hint">Tỷ trọng tương đối trong pool, không phải xác suất Wish. Chỉ thêm Item đã publish từ danh mục Core.</p>
 <div className={"heading-actions "+wishActions.itemPicker} data-wish-item-picker><select aria-label="Item đã publish" className={"edit-input "+wishActions.itemSelect} disabled={disabled} value={selected} onChange={e=>setSelected(e.target.value)}><option value="">Chọn Item</option>{items.filter(i=>!pool.some(x=>x.itemId===i.itemId)).map(i=><option key={i.itemId} value={i.itemId}>{i.name} · r{i.revision}</option>)}</select><button type="button" className="secondary-btn" disabled={disabled||!selected} onClick={()=>{apply(()=>addBannerItem(draft,selected,items));setSelected("");}}>Thêm Item</button></div>
 <div className="table-scroll"><table><thead><tr>{["Item","Revision","Weight","Relative pool weight (%)","Featured",""].map((k,i)=><th scope="col" key={i} style={i===0?{position:"static",width:180}:undefined}>{k}</th>)}</tr></thead><tbody>{pool.map(i=><tr key={i.itemId}><td style={{position:"static"}}>{onPreview?<button type="button" className="secondary-btn" disabled={disabled} onClick={()=>onPreview({itemId:i.itemId,revision:i.revision})}>{items.find(x=>x.itemId===i.itemId&&x.revision===i.revision)?.name??i.itemId}</button>:items.find(x=>x.itemId===i.itemId&&x.revision===i.revision)?.name??i.itemId}</td><td>{i.revision}</td><td><input className="edit-input" type="number" min={0} step="any" disabled={disabled} aria-label={"Weight "+i.itemId} aria-invalid={!Number.isFinite(i.weight)||i.weight<=0} value={Number.isFinite(i.weight)?i.weight:""} onChange={e=>{const n=e.currentTarget.valueAsNumber;onChange({...draft,value:{...draft.value,pool:pool.map(x=>x.itemId===i.itemId?{...x,weight:n}:x)}});setError(!Number.isFinite(n)||n<=0?"Weight phải lớn hơn 0.":"");}}/></td><td>{pool.every(x=>Number.isFinite(x.weight)&&x.weight>0)?Number((100*(i.weight/max)/total).toFixed(8)):"—"}</td><td><input type="checkbox" aria-label={"Featured "+i.itemId} checked={i.featured} disabled={disabled} onChange={e=>apply(()=>changeBannerItem(draft,i.itemId,{featured:e.target.checked}))}/></td><td><button type="button" className="secondary-btn" disabled={disabled} onClick={()=>apply(()=>removeBannerItem(draft,i.itemId))}>Bỏ Item</button></td></tr>)}</tbody></table></div>
 {error&&<p role="alert">{error}</p>}
 </section>;
}
