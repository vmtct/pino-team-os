"use client";
/** PAP-1768 — Parent Center multi-select F1 / Epic PAP-1384.
 * Live directory labels are read-only until exact source-owned options + effective grants exist.
 * The F3 ACL debt is PAP-1922 (Epic PAP-9 PLT-ACCESS), Founder-explicit LOCKED.
 */
import {useState} from "react";

import {planParentDirectCenters,safeParentCenterLabels,validateParentCenterRead,
  type ParentCenterVerified} from "./parent-center-multiselect-model";

export function ParentCenterMultiSelect({
  fallbackCenterNames,verified,canEdit=false,onSaveDirect,
}:{
  fallbackCenterNames:readonly string[];
  verified?:ParentCenterVerified;
  canEdit?:boolean;
  onSaveDirect?:(directIds:readonly string[])=>Promise<void>;
}) {
  const [draft,setDraft]=useState<readonly string[]|null>(null);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  // Never infer permission or relationship type from the string-only directory projection.
  let source:ParentCenterVerified|undefined;
  let names:readonly string[]=[];
  try {
    names=safeParentCenterLabels(fallbackCenterNames);
    if(verified)source=validateParentCenterRead(verified);
  } catch {
    return <p role="alert">Không thể xác minh danh sách cơ sở của Phụ huynh.</p>;
  }
  const editable=!!source&&canEdit&&typeof onSaveDirect==="function";
  const original=source?.centers.filter(c=>c.direct).map(c=>c.centerId)??[];
  const selection=draft??original;
  const changed=!!draft && draft.slice().sort().join("|")!==original.slice().sort().join("|");
  const toggle=(id:string)=>{
    if(!editable||busy||!source)return;
    const next=selection.includes(id)?selection.filter(v=>v!==id):[...selection,id];
    try {planParentDirectCenters(source,next);setDraft(next);setError("");}
    catch {setError("Không thể thay đổi cơ sở kế thừa hoặc vượt phạm vi được cấp quyền.");}
  };
  const save=async()=>{
    if(!editable||!onSaveDirect||!source||busy||!changed)return;
    let ids:readonly string[];
    try {ids=planParentDirectCenters(source,selection);}
    catch {setError("Phạm vi cơ sở không hợp lệ.");return;}
    setBusy(true);setError("");
    try {await onSaveDirect(ids);setDraft(null);}
    catch {setError("Không thể lưu liên kết cơ sở. Vui lòng tải lại dữ liệu.");}
    finally {setBusy(false);}
  };
  return <section aria-label="Cơ sở liên kết" data-parent-center-multiselect="PAP-1768-F1"
    className="v24-prop-section">
    <h3>Cơ sở</h3>
    {source ? <fieldset disabled={!editable||busy} aria-label="Chọn cơ sở cho Phụ huynh">
      {source.centers.map(option=><label key={option.centerId}>
        <input type="checkbox" checked={option.inherited||selection.includes(option.centerId)}
          disabled={!editable||busy||option.inherited}
          onChange={()=>toggle(option.centerId)}/>
        <span>{option.centerName}</span>
        {option.inherited&&<span> · Kế thừa từ học viên</span>}
      </label>)}
    </fieldset> : <ul aria-label="Cơ sở hiện có">
      {names.length ? names.map(name=><li key={name}>{name}</li>) : <li>Chưa có cơ sở</li>}
    </ul>}
    {editable&&changed&&<button type="button" disabled={busy} onClick={()=>void save()}>
      {busy?"Đang lưu…":"Lưu cơ sở"}</button>}
    {error&&<p role="alert">{error}</p>}
  </section>;
}
