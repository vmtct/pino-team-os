"use client";
/** PAP-2153 — original grant and Scene/Layer controls; confirmation before any command. */
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
 const [grantId,setGrantId]=useState("");
 const currentStamp=worldConfirmationStamp(state,grants);
 const [observedStamp,setObservedStamp]=useState(currentStamp);
 const [invalidated,setInvalidated]=useState(false);
 const changed=observedStamp!==currentStamp;
 if(changed){setObservedStamp(currentStamp);setGrantId("");if(selected!==null){setSelected(null);setLabel("");setInvalidated(true);}}
 const stale=changed||invalidated;
 const choices=worldChoices(scope,state,grants,instanceId);
 const active=selected&&choices.find(c=>JSON.stringify(c.intent)===JSON.stringify(selected.intent));
 const intent=active?(active.intent.kind==="grant"?{...active.intent,label}:active.intent):null;
 let valid=false;
 if(intent&&!stale){try{buildWorldCommand(state,intent,grants);valid=true}catch{/* invalid or no longer permitted */}}
 const choose=(c:WorldChoice|undefined)=>{if(!busy&&c){setInvalidated(false);setSelected(c);setLabel(c.intent.kind==="grant"?c.intent.label:"");}};
 const grantChoice=choices.find(c=>c.intent.kind==="grant"&&c.intent.worldId===grantId);
 const instance=state.instances.find(i=>i.id===instanceId);
 const live=choices.find(c=>c.intent.kind==="live");
 if(instanceId===null&&!choices.length)return null;
 if(instanceId!==null&&!instance)return null;
 return <section aria-label="Thao tác World" style={{display:"grid",gap:12,minWidth:0}}>
 {instanceId===null?<div data-world-grant-toolbar style={{display:"flex",flexWrap:"wrap",alignItems:"end",gap:12,minWidth:0}}>
 <label style={{display:"grid",gap:6,flex:"1 1 200px",maxWidth:320,minWidth:0}}><span className="pds-property-label">World khả dụng</span><select className="pds-property-input" style={{minHeight:44,color:"var(--bo-color-text)",borderColor:"var(--bo-color-border)"}} aria-label="Chọn World để cấp" data-world-grant value={grantChoice?grantId:""} disabled={busy} onChange={e=>{setGrantId(e.target.value);setSelected(null);setInvalidated(false);}}><option value="">Chọn World</option>{choices.map(c=>c.intent.kind==="grant"?<option key={c.intent.worldId} value={c.intent.worldId}>{c.intent.label}</option>:null)}</select></label>
 <button type="button" className="primary-btn" style={{minHeight:44}} disabled={busy||!grantChoice} onClick={()=>choose(grantChoice)}>Cấp World</button>
 </div>:instance&&<>
 {instance.status==="INACTIVE"&&<div><button type="button" className="secondary-btn" disabled={busy||!live} onClick={()=>choose(live)}>Đặt LIVE</button></div>}
 {instance.world.scenes.map(scene=>{
 const choice=choices.find(c=>c.intent.kind==="scene"&&c.intent.sceneId===scene.id);
 return <div key={scene.id} style={{display:"grid",gap:6}}><label style={{display:"flex",alignItems:"center",gap:8}}><input type="checkbox" data-world-scene={scene.id} checked={instance.sceneAccess[scene.id]===true} disabled={busy||!choice} onChange={()=>choose(choice)}/>{scene.displayName}</label>
 {scene.layers.filter(l=>l.kind==="MEDIA").map(layer=>{
 const layerChoice=choices.find(c=>c.intent.kind==="layer"&&c.intent.layerId===layer.id);
 return <label key={layer.id} style={{display:"flex",alignItems:"center",gap:8,paddingInlineStart:24}}><input type="checkbox" data-world-layer={layer.id} checked={instance.unlockedLayerIds.includes(layer.id)} disabled={busy||!layerChoice} onChange={()=>choose(layerChoice)}/>{layer.displayName}</label>;
 })}</div>;
 })}
 {!instance.world.scenes.length&&<p>World chưa có cảnh.</p>}
 </>}
 {stale&&<p role="alert">Dữ liệu đã thay đổi. Vui lòng chọn lại thao tác.</p>}
 {active&&intent&&!stale&&<section aria-label="Xác nhận thao tác" data-world-confirmation style={{display:"grid",gap:12,padding:16,border:"1px solid var(--bo-color-border)",borderRadius:12,background:"var(--bo-color-surface)",minWidth:0,maxWidth:520,boxSizing:"border-box"}}>
 <header style={{display:"grid",gap:6}}><h4 style={{margin:0,fontSize:14,color:"var(--bo-color-text)"}}>{active.label}</h4>{active.confirmation&&<p style={{margin:0,lineHeight:1.5}}>{active.confirmation}</p>}</header>
 {intent.kind==="grant"&&<label style={{display:"grid",gap:6,minWidth:0}}><span className="pds-property-label">Tên World</span><input className="pds-property-input" style={{minHeight:44,color:"var(--bo-color-text)",borderColor:"var(--bo-color-border)"}} value={label} maxLength={180} disabled={busy} onChange={e=>setLabel(e.target.value)}/></label>}
 <div style={{display:"flex",flexWrap:"wrap",justifyContent:"flex-end",gap:8}}><button type="button" className="secondary-btn" disabled={busy} onClick={()=>setSelected(null)}>Hủy</button>
 <button type="button" className="primary-btn" disabled={busy||!valid} onClick={()=>{if(!busy&&valid){setSelected(null);onConfirm(intent)}}}>Xác nhận</button></div>
 </section>}
 </section>;
}
