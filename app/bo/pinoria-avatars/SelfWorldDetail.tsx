"use client";
/** PAP-2153 — read-only detail for the selected Avatar instance, no network side effects. */
import {formatPinoDateTime} from "@/lib/pino-datetime";
import type {AvatarWorldState,Scope} from "./avatar-world-contract";
type Props={scope:Scope;state:AvatarWorldState;instanceId:string;onBack:()=>void};
export function SelfWorldDetail({scope,state,instanceId,onBack}:Props){
 if(state.selfId!==scope.selfId||state.centerId!==scope.centerId||state.studentProfileId!==scope.studentProfileId)return <p role="alert">World không thuộc Avatar tại cơ sở này.</p>;
 const instance=state.instances.find(i=>i.id===instanceId);
 if(!instance)return <div role="alert">World không còn khả dụng. <button type="button" className="secondary-btn" onClick={onBack}>Quay lại</button></div>;
 return <section aria-label="Chi tiết World">
 <button type="button" className="secondary-btn" onClick={onBack}>Quay lại</button>
 <h3>{instance.displayLabel}</h3><p>{instance.world.displayName} · {instance.status}</p>
 <p>Ngày tạo: {formatPinoDateTime(instance.createdAt)} · {instance.createdByUser??"—"}</p><p>Ngày cập nhật: {formatPinoDateTime(instance.updatedAt)} · {instance.updatedByUser??"—"}</p>
 <p>Ngày cấp: {formatPinoDateTime(instance.grantedAt)}</p>
 {instance.revokedAt&&<p>Ngày thu hồi: {formatPinoDateTime(instance.revokedAt)}</p>}
 {instance.world.scenes.length===0?<p role="status">Chưa có cảnh.</p>:instance.world.scenes.map(scene=><section className="grid-card" key={scene.id}>
 <h4>{scene.displayName}</h4><p>{instance.sceneAccess[scene.id]?"Đã mở":"Đang khóa"} · {scene.status==="DISABLED"?"Ngừng hoạt động":"Đang hoạt động"}</p>
 <div className="table-scroll" tabIndex={0} aria-label={"Layer · "+scene.displayName}><table className="data-table"><thead><tr><th scope="col">Layer</th><th scope="col">Trạng thái</th></tr></thead><tbody>
 {scene.layers.map(layer=><tr key={layer.id}><td>{layer.displayName}</td><td>{layer.kind==="CHARACTER"?"Avatar mặc định":!layer.enabled?"Ngừng hoạt động":instance.sceneAccess[scene.id]&&instance.unlockedLayerIds.includes(layer.id)?"Đã mở":"Đang khóa"}</td></tr>)}
 </tbody></table></div></section>)}</section>;
}
