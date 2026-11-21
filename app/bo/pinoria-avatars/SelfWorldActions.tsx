"use client";
/** PAP-2153 — controlled confirmation panel, no network or authority mutation. */
import {useState} from "react";
import {worldConfirmationStamp} from "./avatar-world-confirmation";
import {buildWorldCommand,type AvatarWorldState,type Scope,type WorldIntent} from "./avatar-world-contract";
import {worldChoices,type WorldChoice} from "./avatar-world-choices";
type Props={scope:Scope;state:AvatarWorldState;grants:ReadonlySet<string>;instanceId:string|null;busy:boolean;onConfirm:(intent:WorldIntent)=>void};
export function SelfWorldActions(props:Props){
 const {scope,state,instanceId}=props;
 if(state.selfId!==scope.selfId||state.centerId!==scope.centerId||state.studentProfileId!==scope.studentProfileId)return null;
 return <ActionPanel key={[scope.selfId,scope.centerId,scope.studentProfileId,instanceId??"grant"].join(":")} {...props}/>;
}
function ActionPanel({scope,state,grants,instanceId,busy,onConfirm}:Props){
 const [selected,setSelected]=useState<WorldChoice|null>(null);
 const [label,setLabel]=useState("");
  const currentStamp=worldConfirmationStamp(state,grants);
 const [observedStamp,setObservedStamp]=useState(currentStamp);
 const [invalidated,setInvalidated]=useState(false);
 const changed=observedStamp!==currentStamp;
 if(changed){setObservedStamp(currentStamp);if(selected!==null){setSelected(null);setLabel("");setInvalidated(true);}}
 const stale=changed||invalidated;
 const choices=worldChoices(scope,state,grants,instanceId);
 const active=selected&&choices.find(c=>JSON.stringify(c.intent)===JSON.stringify(selected.intent));
 const intent=active?(active.intent.kind==="grant"?{...active.intent,label}:active.intent):null;
 let valid=false;
 if(intent&&!stale){try{buildWorldCommand(state,intent,grants);valid=true}catch{/* invalid or no longer permitted */}}
 if(!choices.length)return null;
 return <section aria-label="Thao tác World">
 {choices.map(c=><button type="button" className="secondary-btn" key={JSON.stringify(c.intent)} disabled={busy} onClick={()=>{setInvalidated(false);setSelected(c);setLabel(c.intent.kind==="grant"?c.intent.label:"")}}>{c.label}</button>)}
 {stale&&<p role="alert">Dữ liệu đã thay đổi. Vui lòng chọn lại thao tác.</p>}
 {active&&intent&&!stale&&<section aria-label="Xác nhận thao tác">
 <h4>{active.label}</h4>{active.confirmation&&<p>{active.confirmation}</p>}
 {intent.kind==="grant"&&<label>Tên World<input value={label} maxLength={180} disabled={busy} onChange={e=>setLabel(e.target.value)}/></label>}
 <button type="button" className="secondary-btn" disabled={busy} onClick={()=>setSelected(null)}>Hủy</button>
 <button type="button" className="primary-btn" disabled={busy||!valid} onClick={()=>{if(!busy&&valid){setSelected(null);onConfirm(intent)}}}>Xác nhận</button>
 </section>}
 </section>;
}
