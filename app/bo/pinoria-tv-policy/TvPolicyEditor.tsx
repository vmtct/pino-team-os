"use client";
import { useCallback, useMemo, useState } from "react";
import {
  KINDS, FIELDS, defaultPolicy, policyIssues, safeDemoProjection, tvPolicyApi,
  type PolicyKind, type ProjectionPolicy, type PolicyScope, type PolicyVersion,
} from "@/lib/pinoria-tv-policy-client";
import styles from "./policy.module.css";
const labels:Record<string,string>={
  ARRIVAL:"Arrival",QUICK_CHOICE:"Quick Choice",DEPARTURE:"Departure",
  WISH_REVEAL:"Wish reveal",EGG_HATCH:"Egg hatch",
  COMPANION_RITUAL:"Companion ritual",ONBOARDING_CEREMONY:"Onboarding",
  name:"Tên Piner",path:"Path",room:"Phòng học",companion:"Companion",
  pls:"PLS",fruit:"Fruit",highlight:"Highlight",
};
const CENTER=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export default function TvPolicyEditor(){
  const [kind,setKind]=useState<PolicyScope["kind"]>("CENTER");
  const [centerId,setCenterId]=useState("");
  const [policy,setPolicy]=useState<ProjectionPolicy>(defaultPolicy);
  const [saved,setSaved]=useState("");
  const [revision,setRevision]=useState(0);
  const [versions,setVersions]=useState<PolicyVersion[]>([]);
  const [previewKind,setPreviewKind]=useState<PolicyKind>("DEPARTURE");
  const [busy,setBusy]=useState(false);
  const [notice,setNotice]=useState("");
  const [error,setError]=useState("");
  const scope=useMemo<PolicyScope|null>(()=>kind==="DEFAULT"?{kind:"DEFAULT"}:
    CENTER.test(centerId.trim())?{kind:"CENTER",centerId:centerId.trim()}:null,[kind,centerId]);
  const dirty=JSON.stringify(policy)!==saved;
  const issues=policyIssues(policy);
  const preview=safeDemoProjection(policy,previewKind,new Date());

  const refresh=useCallback(async (target:PolicyScope)=>{
    setBusy(true);setError("");setNotice("");
    try{
      const [head,history]=await Promise.all([tvPolicyApi.head(target),tvPolicyApi.versions(target)]);
      setRevision(head?.revision??0);
      setVersions(history);
      const recent=history[0];
      const v=recent?await tvPolicyApi.version(target,recent.id):null;
      const next=v?.configuration??defaultPolicy();
      setPolicy(next);setSaved(JSON.stringify(next));
      setNotice(recent?"Đã tải bản cấu hình gần nhất. Bản này không nhất thiết đã publish.":"Chưa có cấu hình; đang dùng privacy-safe defaults.");
    }catch(e){setError(e instanceof Error?e.message:"Không thể tải policy");}
    finally{setBusy(false);}
  },[]);
  async function act(command:"drafts"|"publish"|"revert",versionId?:string){
    if(!scope||busy)return;
    if(command==="drafts"&&issues.length){setError(issues.join("; "));return;}
    if(command!=="drafts"&&!versionId){setError("Chọn phiên bản trước khi thực hiện.");return;}
    if(command!=="drafts"&&!window.confirm(command==="publish"
      ?"Publish version này cho TV thuộc scope đã chọn?"
      :"Revert về version cũ? Bản hiện tại vẫn được giữ nguyên trong lịch sử."))return;
    setBusy(true);setError("");setNotice("");
    try{
      const body=command==="drafts"
        ?{scope,expectedRevision:revision,configuration:policy}
        :{scope,expectedRevision:revision,versionId};
      await tvPolicyApi.write(command,body);
      setNotice("Thành công, đang tải phiên bản mới...");
      const [head,history]=await Promise.all([tvPolicyApi.head(scope),tvPolicyApi.versions(scope)]);
      setRevision(head?.revision??0);setVersions(history);
      const latest=history[0];
      const v=latest?await tvPolicyApi.version(scope,latest.id):null;
      const next=v?.configuration??defaultPolicy();
      setPolicy(next);setSaved(JSON.stringify(next));
      setNotice(command==="drafts"?"Draft đã lưu. Publish là thao tác riêng.":command==="revert"
        ?"Revert đã được Core ghi nhận và audit.":"Đã publish sau khi Core xác nhận.");
    }catch(e){setError(e instanceof Error?e.message:"Không thể lưu policy");}
    finally{setBusy(false);}
  }
  function updateEvent(k:PolicyKind,partial:Partial<ProjectionPolicy["events"][PolicyKind]>) {
    setPolicy(p=>({...p,events:{...p.events,[k]:{...p.events[k],...partial}}}));
  }
  return <main className={styles.shell}>
    <header className={styles.header}>
      <div><p className={styles.kicker}>PAP-660 · Pinoria TV</p><h1>Projection Policies</h1>
        <p>Điều chỉnh nội dung được phép xuất hiện trên TV chung. Không thay đổi dữ liệu học viên hay quyền sở hữu.</p></div>
    </header>
    <section className={styles.card}>
      <h2>Phạm vi áp dụng</h2>
      <div className={styles.row}>
        <label>Scope <select value={kind} onChange={e=>{setKind(e.target.value as PolicyScope["kind"]);setSaved("");setVersions([]);}}>
          <option value="CENTER">Center</option><option value="DEFAULT">Default (Founder)</option>
        </select></label>
        {kind==="CENTER"&&<label>Center ID <input value={centerId} onChange={e=>{setCenterId(e.target.value);setSaved("");setVersions([]);}} placeholder="UUID của Center" /></label>}
        <button disabled={!scope||busy} onClick={()=>{if(scope)void refresh(scope);}}>Đọc từ Core</button>
      </div>
      <p className={styles.muted}>Draft không ảnh hưởng TV. Chỉ Publish/Revert mới đổi bản đang áp dụng. Khi mất cấu hình sẽ dùng privacy-safe default hoặc last-known-good.</p>
      <p className={styles.muted}>Revision hiện tại: {revision} · Các bản đã lưu: {versions.length} {dirty?"· Có chỉnh sửa chưa lưu":""}</p>
    </section>
    <section className={styles.card}>
      <h2>Quy tắc sự kiện</h2>
      <label className={styles.toggle}><input type="checkbox" checked={policy.quietMode} onChange={e=>setPolicy(p=>({...p,quietMode:e.target.checked}))}/>Quiet Mode</label>
      <div className={styles.tableWrap}><table className={styles.table}><thead><tr><th>Scene</th><th>Hiển thị</th><th>Ưu tiên (0–100)</th><th>Hết hạn (giây)</th><th>Tắt khi yên tĩnh</th></tr></thead>
        <tbody>{KINDS.map(k=><tr key={k}><td>{labels[k]}</td>
          <td><input aria-label={"Enable "+k} type="checkbox" checked={policy.events[k].enabled} onChange={e=>updateEvent(k,{enabled:e.target.checked})}/></td>
          <td><input aria-label={"Priority "+k} type="number" min="0" max="100" value={policy.events[k].priority} onChange={e=>updateEvent(k,{priority:Number(e.target.value)})}/></td>
          <td><input aria-label={"Expiry "+k} type="number" min="1" max="86400" value={policy.events[k].maxAgeSeconds} onChange={e=>updateEvent(k,{maxAgeSeconds:Number(e.target.value)})}/></td>
          <td><input aria-label={"Quiet "+k} type="checkbox" checked={policy.events[k].suppressInQuietMode} onChange={e=>updateEvent(k,{suppressInQuietMode:e.target.checked})}/></td>
        </tr>)}</tbody></table></div>
    </section>
    <section className={styles.card}>
      <h2>Quyền hiển thị dữ liệu</h2>
      <p className={styles.muted}>Tất cả trường lạ luôn bị loại. Tắt trường ở đây nghĩa là trường không xuất hiện trong projection, không chỉ ẩn trên giao diện.</p>
      <div className={styles.flags}>{FIELDS.map(f=><label className={styles.toggle} key={f}><input type="checkbox" checked={policy.visibleContext[f]} onChange={e=>setPolicy(p=>({...p,visibleContext:{...p.visibleContext,[f]:e.target.checked}}))}/>{labels[f]}</label>)}</div>
    </section>
    <section className={styles.card}>
      <h2>Preview an toàn</h2>
      <label>Loại event <select value={previewKind} onChange={e=>setPreviewKind(e.target.value as PolicyKind)}>{KINDS.map(k=><option key={k} value={k}>{labels[k]}</option>)}</select></label>
      <p>{preview.allowed?"Được hiển thị — priority "+preview.priority:"Bị chặn do rule/quiet mode"}</p>
      <pre className={styles.pre}>{JSON.stringify(preview.context,null,2)}</pre>
      <p className={styles.muted}>Demo dữ liệu giả lập, không phải xác nhận TV runtime hoặc thông tin học viên thực tế.</p>
    </section>
    <section className={styles.card}>
      <h2>Publish & lịch sử</h2>
      {issues.length>0&&<p className={styles.error}>{issues.join("; ")}</p>}
      {error&&<p role="alert" className={styles.error}>{error}</p>}
      {notice&&<p role="status" className={styles.success}>{notice}</p>}
      <div className={styles.row}>
        <button disabled={!scope||busy||issues.length>0} onClick={()=>void act("drafts")}>Lưu draft</button>
        <button disabled={!scope||busy||dirty||!versions[0]} onClick={()=>void act("publish",versions[0]?.id)}>Publish bản gần nhất</button>
      </div>
      <div className={styles.history}>{versions.map(v=><div key={v.id} className={styles.version}>
        <span>v{v.revision} · {v.createdAt} {v.applied?"· Đang áp dụng":""}</span>
        <button disabled={!scope||busy||dirty||v.applied} onClick={()=>void act("revert",v.id)}>Revert</button>
      </div>)}</div>
    </section>
  </main>;
}
