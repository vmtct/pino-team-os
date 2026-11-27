"use client";
/** PAP-2153 — presentation-only summary within the approved Avatar World tab. */
import {formatPinoDateTime} from "@/lib/pino-datetime";
import type {AvatarWorldState,Scope} from "./avatar-world-contract";
type Props={scope:Scope;state:AvatarWorldState|null;status:"loading"|"ready"|"denied"|"error";onReload:()=>void;onOpen:(id:string)=>void};
const statusLabels={INACTIVE:"Chưa kích hoạt",LIVE:"LIVE",REVOKED:"Đã thu hồi"} as const;
export function SelfWorldSummary({scope,state,status,onReload,onOpen}:Props){
 if(status==="denied")return <p role="alert">Không có quyền xem World tại cơ sở này.</p>;
 if(status==="error")return <div role="alert">Không tải được World. <button type="button" className="secondary-btn" onClick={onReload}>Thử lại</button></div>;
 if(status==="loading")return <p role="status">Đang tải World…</p>;
 if(!state||state.selfId!==scope.selfId||state.centerId!==scope.centerId||state.studentProfileId!==scope.studentProfileId)return <div role="alert">Trạng thái World đã thay đổi. <button type="button" className="secondary-btn" onClick={onReload}>Tải lại</button></div>;
 if(!state.instances.length)return <p role="status">Chưa có World.</p>;
 return <section className="grid-card"><div className="table-scroll" tabIndex={0} aria-label="World của Avatar">
 <table className="data-table"><thead><tr><th scope="col">World</th><th scope="col">Trạng thái</th><th scope="col">Cảnh đã mở</th><th scope="col">Layer đã mở</th><th scope="col">Ngày tạo</th><th scope="col">Người tạo</th><th scope="col">Ngày cập nhật</th><th scope="col">Người cập nhật</th></tr></thead>
 <tbody>{state.instances.map(i=><tr key={i.id}><td><button type="button" className="secondary-btn" onClick={()=>onOpen(i.id)}>{i.displayLabel}</button></td><td>{statusLabels[i.status]}</td><td>{i.world.scenes.filter(s=>i.sceneAccess[s.id]).length}/{i.world.scenes.length}</td><td>{i.unlockedLayerIds.length}</td><td>{formatPinoDateTime(i.createdAt)}</td><td>{i.createdByUser??"—"}</td><td>{formatPinoDateTime(i.updatedAt)}</td><td>{i.updatedByUser??"—"}</td></tr>)}</tbody></table></div></section>;
}
