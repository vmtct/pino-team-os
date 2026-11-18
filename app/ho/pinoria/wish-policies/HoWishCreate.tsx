"use client";
/** PAP-2030 / PNR-WISH — explicit Create Draft, never implicit publication. */
import {useRef,useState} from "react";
import {DrawerFrame} from "@/app/components/workspace-renderer/DrawerFrame";
import {savePolicyDraft,saveBannerDraft,confirmSavedWishDraft,type PolicyValue} from "@/lib/pls-wish-ho-contract";
import {BannerDraftItems,BannerDraftOverview} from "../wish-banners/HoWishBannerDraftEditor";
import type {BannerEdit,PublishedWishItem} from "../wish-banners/wish-banner-edit";
type Receipt={receipt:unknown;readback:unknown};
type PolicyCommand=ReturnType<typeof savePolicyDraft>;
type BannerCommand=ReturnType<typeof saveBannerDraft>;
type Common={centerLabels:Readonly<Record<string,string>>;onClose:()=>void;onCreated:(recordId:string)=>void;onReload:()=>void};
type Props=Common&({scope:"policy";existing:readonly string[];save:(c:PolicyCommand)=>Promise<Receipt>}|{scope:"banner";bannerId:string;items:readonly PublishedWishItem[];save:(c:BannerCommand)=>Promise<Receipt>});
const initialDefinition:PolicyValue["definition"]={rates:[.8036,.1764,.02],hard4:5,hard5:16,soft5:12,curve:[{position:12,rate:.08},{position:13,rate:.16},{position:14,rate:.3},{position:15,rate:.55},{position:16,rate:1}],featuredGuarantee:true};
export function HoWishCreate(p:Props){
 const [name,setName]=useState(""),[center,setCenter]=useState(""),[cost,setCost]=useState("100"),[family,setFamily]=useState("");
 const [banner,setBanner]=useState<BannerEdit>(()=>({base:Object.freeze({recordId:p.scope==="banner"?p.bannerId:"",pointerVersion:0,draftVersion:0,publishedId:null}),name:"",value:{bannerId:p.scope==="banner"?p.bannerId:"",centerId:null,familyId:"",startsAt:"",endsAt:"",pool:[]}}));
 const [busy,setBusy]=useState(false),[uncertain,setUncertain]=useState(false),[error,setError]=useState("");
 const flight=useRef(false);
 const disabled=busy||uncertain;
 function close(){if(!flight.current&&!uncertain)p.onClose();}
 async function submit(){
  if(disabled||flight.current)return;
  let command:PolicyCommand|BannerCommand;
  try{if(p.scope==="policy"){
   if(!Object.hasOwn(p.centerLabels,center)||p.existing.includes(center)||!/^\d+$/.test(cost))throw Error("Chọn Center chưa có Policy và nhập PLS hợp lệ.");
   command=savePolicyDraft({centerId:center,cost:Number(cost),definition:initialDefinition},name,null);
  }else{
   if(banner.value.centerId!==null&&!Object.hasOwn(p.centerLabels,banner.value.centerId))throw Error("Center chưa hợp lệ.");
   command=saveBannerDraft({...banner.value,familyId:family},banner.name,null);
  }}catch(e){setError(e instanceof Error?e.message:"Dữ liệu không hợp lệ.");return;}
  flight.current=true;setBusy(true);setError("");
  try{
   const r=p.scope==="policy"&&command.action==="savePolicy"?await p.save(command):p.scope==="banner"&&command.action==="saveBanner"?await p.save(command):null;
   if(!r)throw Error("Sai loại bản nháp.");
   const h=confirmSavedWishDraft(command,r.receipt,r.readback);if(h.active||h.published||h.pointerVersion!==0)throw Error("Bản ghi không phải bản nháp mới.");
   p.onCreated(h.recordId);
  }catch(e){setUncertain(true);setError((e instanceof Error?e.message:"Không xác minh được bản nháp.")+" Tải lại trước khi thử lại.");}
  finally{flight.current=false;setBusy(false);}
 }
 const bprops=p.scope==="banner"?{draft:banner,onChange:setBanner,disabled,items:p.items,centerLabels:p.centerLabels}:null;
 return <DrawerFrame title={p.scope==="policy"?"Thêm Wish Policy":"Thêm Wish Banner"} path={p.scope==="policy"?"Wish Policies":"Wish Banners"} onClose={close}
 footer={<><button type="button" className="secondary-btn" disabled={disabled} onClick={close}>Hủy</button>{uncertain?<button type="button" className="primary-btn" onClick={p.onReload}>Tải lại để đối soát</button>:<button type="button" className="primary-btn" disabled={busy} onClick={()=>void submit()}>{busy?"Đang lưu…":"Tạo bản nháp"}</button>}</>}>
 {p.scope==="policy"?<div className="v24-prop-grid">
 <label className="v24-prop-item">Tên Policy<input className="edit-input" maxLength={160} value={name} disabled={disabled} onChange={e=>setName(e.target.value)}/></label>
 <label className="v24-prop-item">Center<select aria-label="Center" className="edit-input" value={center} disabled={disabled} onChange={e=>setCenter(e.target.value)}><option value="">Chọn Center</option>{Object.entries(p.centerLabels).filter(([id])=>!p.existing.includes(id)).map(([id,label])=><option value={id} key={id}>{label}</option>)}</select></label>
 <label className="v24-prop-item">PLS / Wish<input className="edit-input" type="number" min={1} step={1} value={cost} disabled={disabled} onChange={e=>setCost(e.target.value)}/></label>
 <p className="settings-hint">Khởi tạo bản nháp theo cấu hình S0: 80.36 / 17.64 / 2%, hard pity 4★: 5, soft/hard 5★: 12/16. Chỉnh chi tiết trước khi Publish.</p>
 </div>:bprops&&<><label className="v24-prop-item">Family<input className="edit-input" maxLength={160} value={family} disabled={disabled} onChange={e=>setFamily(e.target.value)}/></label><BannerDraftOverview {...bprops}/><BannerDraftItems {...bprops}/></>}
 <p className="settings-hint">Chỉ tạo bản nháp. Không tự Publish hoặc áp dụng cho giao dịch Wish.</p>
 {error&&<p role="alert">{error}</p>}
 </DrawerFrame>;
}
