"use client";
import styles from "./HoSpecialtyMissionsTab.module.css";
import { useMemo, useState } from "react";
import { SpecialtyMissionPicker } from "./SpecialtyMissionPicker";
import type { SpecialtyMissionOption } from "@/lib/specialty-mission-picker";

/** PAP-1495 / SPEC-UNLOCK. HO business tab only, not another TDD shell or Mission writer. */
export interface SpecialtyMissionLevel {
  id: string;
  name: string;
  order: number;
  missionIds: readonly string[];
}
export type VerifiedRelationReceipt = { verified: true; version: number };
export function HoSpecialtyMissionsTab({
  pathProgramId,levels,missionCatalog,disabled=false,onLink,onUnlink,onOpenMission,
}:{
  pathProgramId:string;
  levels:readonly SpecialtyMissionLevel[];
  missionCatalog:readonly SpecialtyMissionOption[];
  disabled?:boolean;
  onLink:(levelId:string,missionId:string)=>Promise<VerifiedRelationReceipt>;
  onUnlink:(levelId:string,missionId:string)=>Promise<VerifiedRelationReceipt>;
  onOpenMission:(missionId:string)=>void;
}){
  const ordered=useMemo(()=>[...levels].sort((a,b)=>a.order-b.order||a.id.localeCompare(b.id)),[levels]);
  const linked=useMemo(()=>new Set(levels.flatMap(l=>l.missionIds)),[levels]);
  const catalog=useMemo(()=>new Map(missionCatalog.map(m=>[m.id,m])),[missionCatalog]);
  const [levelId,setLevelId]=useState("");
  const [selected,setSelected]=useState<SpecialtyMissionOption|null>(null);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const [success,setSuccess]=useState("");
  const activeLevel=ordered.some(l=>l.id===levelId)?levelId:ordered[0]?.id??"";
  const canLink=!disabled&&!busy&&Boolean(activeLevel)&&Boolean(selected)&&!linked.has(selected?.id??"")&&
    selected?.pathProgramId===pathProgramId&&selected?.status==="ACTIVE"&&selected?.reconciliation==="READY";
  async function call(action:()=>Promise<VerifiedRelationReceipt>,done:string){
    if(busy||disabled)return;
    setBusy(true);setError("");setSuccess("");
    try{
      const receipt=await action();
      if(receipt?.verified!==true||!Number.isSafeInteger(receipt.version)||receipt.version<1)
        throw new Error("READBACK_NOT_VERIFIED");
      setSuccess(done);
      setSelected(null);
    }catch{
      setError("Không thể xác minh thay đổi liên kết. Vui lòng tải lại dữ liệu từ Core.");
    }finally{setBusy(false);}
  }
  return <section aria-label="Nhiệm vụ của Chuyên Đề" className={styles.stack}>
    <section aria-label="Liên kết nhiệm vụ" className="detail-panel"><div className={styles.stack}>
      <h3>Liên kết nhiệm vụ</h3>
      <div className={styles.form} data-specialty-link-form>
        <label className={styles.field}><span className="pds-property-label">Cấp</span>
          <select className="pds-property-input" value={activeLevel} disabled={busy||disabled||!ordered.length}
            onChange={event=>{setLevelId(event.target.value);setSelected(null);setError("");}}>
            {ordered.map(level=><option key={level.id} value={level.id}>{level.name}</option>)}
          </select>
        </label>
        <SpecialtyMissionPicker missions={missionCatalog} pathProgramId={pathProgramId}
          linkedMissionIds={linked} value={selected} onChange={setSelected}
          disabled={busy||disabled||!ordered.length}/>
        <div className={styles.field}><span className="pds-property-label" aria-hidden="true">&nbsp;</span><button type="button" className="primary-btn" disabled={!canLink}
          onClick={()=>{if(!canLink||!selected)return;
            const targetId=activeLevel,missionId=selected.id;
            void call(()=>onLink(targetId,missionId),"Đã xác minh liên kết nhiệm vụ.");
          }}>Liên kết</button></div>
      </div>
      {!ordered.length?<p role="status">Chuyên Đề chưa có Cấp để liên kết.</p>:null}
    </div></section>
    <section aria-label="Nhiệm vụ liên kết" className="detail-panel"><div className={styles.stack}>
      <div className={styles.heading}><h3>Nhiệm vụ liên kết <span className="chip">{linked.size}</span></h3><a className="option-item" href="/ho/learning/missions">Danh mục Nhiệm vụ ↗</a></div>
      {ordered.map(level=><section key={level.id} className={styles.list} aria-label={"Nhiệm vụ "+level.name}>
        <h4>{level.name} <span className="chip">{level.missionIds.length}</span></h4>
        {level.missionIds.length ? <div role="list" className={styles.list} aria-label={"Danh sách nhiệm vụ "+level.name}>
          {level.missionIds.map(missionId=>{
            const mission=catalog.get(missionId);
            const open=()=>{if(mission)onOpenMission(missionId);};
            return <div role="listitem" className={styles.row} key={missionId}>
              <div className={styles.identity}><strong>{mission?.code??missionId}</strong>
              <button type="button" className="option-item" disabled={!mission} onClick={open}>{mission?.name??"Nhiệm vụ không tồn tại"}</button></div>
              <span>{mission?.status==="ACTIVE"&&mission.reconciliation==="READY"?"Đang áp dụng":"Không khả dụng"}</span>
              <button type="button" className="secondary-btn" disabled={busy||disabled}
                aria-label={"Gỡ liên kết "+(mission?.name??missionId)}
                onClick={()=>void call(()=>onUnlink(level.id,missionId),"Đã xác minh gỡ liên kết.")}>Gỡ</button>
            </div>;
          })}
        </div>:<p className="pds-state">Chưa liên kết nhiệm vụ.</p>}
      </section>)}
    </div></section>
    {error?<p role="alert">{error}</p>:null}
    {success?<p role="status">{success}</p>:null}
  </section>;
}
