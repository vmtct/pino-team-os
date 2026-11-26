"use client";
import {useEffect,useState,useRef} from "react";
import {BoDataGrid,BoDataGridBadge,BoDrawer,type BoDataGridColumn} from "@/app/bo/components/data-grid";
import {BoProperties} from "@/app/bo/components/BoProperties";
import {DetailFrame} from "@/app/components/workspace-renderer/DetailFrame";
import {useBoCenterSelection} from "@/app/bo/components/registration/BoCenterSelection";
import {StaffRegistrationReviewQueue} from "./StaffRegistrationReviewQueue";
import {StaffRegistrationIntakeToggle} from "./StaffRegistrationIntakeToggle";
import {boApi,BoApiError} from "@/lib/bo-api";
import styles from "../bo.module.css";

type RequestRow={id:string;centerId:string;displayLabel:string;submittedAt:string;version:number};
type RoleOption={id:string;displayName:string};

type Mode="approve"|"reject";
export type CenterRegistrationReviewBody={expectedVersion:number;assignments?:{roleId:string;scopeType:string;scopeId:string}[];pinoriaIdentity?:{mode:string};reason?:string};
export type CenterRegistrationService={
  list:(centerId:string,signal:AbortSignal)=>Promise<RequestRow[]>;
  roles:(centerId:string,signal:AbortSignal)=>Promise<RoleOption[]>;
  review:(centerId:string,id:string,mode:Mode,body:CenterRegistrationReviewBody,key:string)=>Promise<{registrationRequestId:string;status:string}>;
};
const time=(s:string)=>new Date(s).toLocaleString("vi-VN",{timeZone:"Asia/Ho_Chi_Minh"});
const route="workforce/staff-registration-requests";
const path=(p:string,c:string)=>"/api/bo/"+p+"?"+new URLSearchParams({centerId:c}).toString();
async function get<T>(url:string,signal:AbortSignal):Promise<T>{
  const r=await fetch(url,{cache:"no-store",signal});
  const payload=await r.json() as {data?:T;error?:{message?:string}};
  if(!r.ok||payload.data===undefined)throw new BoApiError(r.status,payload.error?.message??"Không thể tải hồ sơ.",r.headers.get("x-request-id"),!!payload.error?.message);
  return payload.data;
}
const liveCenterRegistrationService:CenterRegistrationService={
  list:(centerId,signal)=>get<RequestRow[]>(path(route,centerId),signal),
  roles:(centerId,signal)=>get<RoleOption[]>(path("workforce/staff-registration-eligible-roles",centerId),signal),
  review:async(centerId,id,mode,body,key)=>{
    const response=await fetch(path(route+"/"+encodeURIComponent(id)+"/"+mode,centerId),{method:"POST",headers:{"content-type":"application/json","idempotency-key":key},body:JSON.stringify(body)});
    const payload=await response.json() as {data?:{registrationRequestId:string;status:string};error?:{message?:string}};
    if(!response.ok||!payload.data)throw Error(payload.error?.message??"Ch\u01b0a x\u00e1c nh\u1eadn \u0111\u01b0\u1ee3c k\u1ebft qu\u1ea3. Th\u1eed l\u1ea1i c\u00f9ng y\u00eau c\u1ea7u.");
    return payload.data;
  },
};
const columns:BoDataGridColumn<RequestRow>[]=[
  {key:"displayLabel",header:"Họ và tên",render:r=>r.displayLabel,minWidth:180},
  {key:"submittedAt",header:"Ngày gửi",render:r=>time(r.submittedAt),minWidth:160},
  {key:"status",header:"Trạng thái",render:()=> <BoDataGridBadge>Chờ duyệt</BoDataGridBadge>,minWidth:110},
];

// Core's Founder-only intake capability distinguishes the legacy global surface.
// A network failure is not a grant or a reason to fall back to global data.
export function StaffRegistrationSection({embedded=false}:{embedded?:boolean}){
  const [mode,setMode]=useState<"loading"|"founder"|"center"|"error">("loading");
  const [error,setError]=useState("");
  useEffect(()=>{
    let active=true;
    void boApi.staffRegistrationIntake().then(()=>{if(active)setMode("founder")}).catch((cause:unknown)=>{
      if(!active)return;
      if(cause instanceof BoApiError&&cause.status===403)setMode("center");
      else {setError(cause instanceof Error?cause.message:"Không thể xác minh quyền.");setMode("error")}
    });
    return()=>{active=false};
  },[]);
  if(mode==="loading")return <p role="status">Đang xác minh quyền duyệt hồ sơ…</p>;
  if(mode==="error")return <p role="alert">{error}</p>;
  if(mode==="founder")return <><StaffRegistrationIntakeToggle/><StaffRegistrationReviewQueue/></>;
  return <StaffCenterRegistrationReview embedded={embedded}/>;
}
function StaffCenterRegistrationReview({embedded}:{embedded:boolean}){
  const scope=useBoCenterSelection();
  const center=scope?.centers.find(c=>c.id===scope.selected);
  if(!scope||scope.loading)return <p role="status">Đang xác thực cơ sở…</p>;
  if(scope.error||!center)return <p role="alert">Chọn cơ sở được cấp quyền.</p>;
  return <CenterReview key={center.id} centerId={center.id} centerName={center.displayName} embedded={embedded}/>;
}
export function CenterReview({centerId,centerName,embedded,service=liveCenterRegistrationService}:{centerId:string;centerName:string;embedded:boolean;service?:CenterRegistrationService}){
  const [rows,setRows]=useState<RequestRow[]>([]);
  const [roles,setRoles]=useState<RoleOption[]>([]);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");
  const [reviewError,setReviewError]=useState("");
  const [reviewReady,setReviewReady]=useState(false);
  const [selected,setSelected]=useState<RequestRow|null>(null);
  const [surface,setSurface]=useState<"table"|"drawer"|"detail">("table");
  const [tab,setTab]=useState("overview");
  const [roleId,setRoleId]=useState("");
  const [reason,setReason]=useState("");
  const [busy,setBusy]=useState(false);
  const [search,setSearch]=useState("");
  const [revision,refresh]=useState(0);
  const [notice,setNotice]=useState("");
  const attempts=useRef(new Map<string,string>());
  const inFlight=useRef(false);
  useEffect(()=>{
    const ctl=new AbortController();
    void service.list(centerId,ctl.signal).then(next=>{
      if(ctl.signal.aborted)return;
      if(!Array.isArray(next)||next.some(r=>r.centerId!==centerId||!Number.isSafeInteger(r.version)||r.version<1))throw Error("Dữ liệu cơ sở không hợp lệ.");
      setRows(next);setLoading(false);
    }).catch((cause:unknown)=>{if(!ctl.signal.aborted){setRows([]);setError(cause instanceof Error?cause.message:"Không thể tải hồ sơ.");setLoading(false)}});
    void service.roles(centerId,ctl.signal).then(next=>{
      if(!ctl.signal.aborted){setRoles(next);setReviewReady(true);}
    }).catch((cause:unknown)=>{if(!ctl.signal.aborted){setRoles([]);setReviewError(cause instanceof Error?cause.message:"Không có quyền duyệt.")}});
    return()=>ctl.abort();
  },[centerId,revision,service]);
  const canClose=()=>!inFlight.current&&(!roleId&&!reason.trim()||window.confirm("Hủy thay đổi chưa lưu?"));
  const resetSelection=()=>{setSelected(null);setRoleId("");setReason("");setSurface("table");setTab("overview");};
  const close=()=>{if(!inFlight.current)resetSelection();};
  const requestClose=()=>{if(canClose())close();};
  async function review(mode:Mode){
    if(!selected||inFlight.current||!reviewReady||reviewError||(mode==="approve"&&!roles.some(r=>r.id===roleId))||(mode==="reject"&&!reason.trim()))return;
    const body=mode==="approve"?{expectedVersion:selected.version,assignments:[{roleId,scopeType:"CENTER",scopeId:centerId}],pinoriaIdentity:{mode:"CREATE_STAFF_ONLY_PERSON"}}:{expectedVersion:selected.version,reason:reason.trim()};
    const fingerprint=JSON.stringify([centerId,selected.id,mode,body]);
    const key=attempts.current.get(fingerprint)??crypto.randomUUID();
    attempts.current.set(fingerprint,key);
    inFlight.current=true;
    setBusy(true);setError("");setNotice("");
    try{
      const receipt=await service.review(centerId,selected.id,mode,body,key);
      if(receipt.registrationRequestId!==selected.id||receipt.status!==(mode==="approve"?"APPROVED":"REJECTED"))throw Error("Ch\u01b0a x\u00e1c nh\u1eadn \u0111\u01b0\u1ee3c k\u1ebft qu\u1ea3. Th\u1eed l\u1ea1i c\u00f9ng y\u00eau c\u1ea7u.");
      setNotice(mode==="approve"?"Đã duyệt hồ sơ.":"Đã từ chối hồ sơ.");
      setRows(current=>current.filter(r=>r.id!==selected.id));
      attempts.current.delete(fingerprint);resetSelection();
      setLoading(true);setReviewReady(false);setReviewError("");refresh(v=>v+1);
    }catch(cause){setError(cause instanceof Error?cause.message:"Chưa xác nhận được kết quả.");}
    finally{inFlight.current=false;setBusy(false)}
  }
  return <section id="staff-registration-review" data-staff-registration-surface={selected?surface:"table"} aria-label="Hồ sơ nhân sự chờ duyệt">
    {surface==="detail"?null:embedded?<p className="settings-hint">{centerName} · Hồ sơ chờ duyệt</p>:<div className="page-heading"><div className="page-heading-left"><h1>Hồ sơ chờ duyệt</h1><p>{centerName}</p></div></div>}
    {notice?<p role="status">{notice}</p>:null}
    {reviewError?<p role="status">{reviewError}</p>:null}
    {error?<p role="alert">{error}</p>:null}
    {surface!=="detail"&&<BoDataGrid rows={rows.filter(r=>r.displayLabel.toLocaleLowerCase("vi-VN").includes(search.toLocaleLowerCase("vi-VN")))}
      columns={columns} rowKey={r=>r.id} caption="Hồ sơ nhân sự chờ duyệt" state={loading?"loading":error&&!rows.length?"error":"ready"}
      stateMessage={error} search={search} onSearchChange={setSearch} searchPlaceholder="Tìm tên nhân viên"
      onRowOpen={r=>{if(canClose()){setSelected(r);setSurface("drawer");setTab("overview");setRoleId("");setReason("");setError("")}}} quickViewOpener
      emptyTitle="Chưa có hồ sơ" emptyMessage="Không có hồ sơ chờ duyệt trong cơ sở này." resultLabel={rows.length+" hồ sơ"}
      toolbarActions={<button type="button" className={styles.secondaryButton} onClick={()=>{if(canClose()){close();setError("");setReviewError("");setReviewReady(false);setLoading(true);refresh(v=>v+1)}}} disabled={busy}>Tải lại</button>}/>}
    {selected&&surface==="drawer"&&<BoDrawer title={selected.displayLabel} eyebrow="Hồ sơ chờ duyệt" mode="view" busy={busy} canClose={canClose} onClose={close}
      footer={<button className={styles.primaryButton} type="button" disabled={busy} onClick={()=>setSurface("detail")}>Mở chi tiết</button>}>
      <BoProperties authority items={[{key:"center",label:"Cơ sở",value:centerName},{key:"date",label:"Ngày gửi",value:time(selected.submittedAt)},{key:"status",label:"Trạng thái",value:"Chờ duyệt"}]}/>
    </BoDrawer>}
    {selected&&surface==="detail"&&<DetailFrame title={selected.displayLabel} subtitle="Hồ sơ chờ duyệt" tabs={[{id:"overview",label:"Tổng quan"},{id:"history",label:"Lịch sử"}]} selected={tab} onSelect={id=>{if(!busy)setTab(id)}} onBack={requestClose}>
      {tab==="history"?<p role="status">Lịch sử chi tiết chưa có trong dữ liệu hồ sơ này.</p>:<>
      <BoProperties authority items={[{key:"center",label:"Cơ sở",value:centerName},{key:"date",label:"Ngày gửi",value:time(selected.submittedAt)},{key:"status",label:"Trạng thái",value:"Chờ duyệt"}]}/>
      <div className={styles.registrationReviewDetail}>
      <label className={styles.field}>Vai trò Staff<select aria-label="Vai trò Staff" value={roleId} disabled={busy||!reviewReady||!!reviewError} onChange={e=>setRoleId(e.target.value)}>
        <option value="">Chọn vai trò</option>{roles.map(r=><option value={r.id} key={r.id}>{r.displayName}</option>)}
      </select></label>
      <p className={styles.registrationPrivacyNote}>Tài khoản mới chỉ được cấp quyền tại cơ sở này.</p>
      <div className={styles.registrationDecisionActions}><button type="button" className={styles.primaryButton} disabled={busy||!reviewReady||!!reviewError||!roleId} onClick={()=>void review("approve")}>Duyệt hồ sơ</button></div>
      <label className={styles.field}>Lý do từ chối<textarea rows={3} aria-label="Lý do từ chối" value={reason} maxLength={500} disabled={busy||!reviewReady||!!reviewError} onChange={e=>setReason(e.target.value)}/></label>
      <div className={styles.registrationDecisionActions}><button type="button" className={styles.secondaryButton} disabled={busy||!reviewReady||!!reviewError||!reason.trim()} onClick={()=>void review("reject")}>Từ chối</button></div>
      </div>
      {error?<p role="alert">{error}</p>:null}{busy?<p role="status">Đang xử lý…</p>:null}
      </>}
    </DetailFrame>}
  </section>;
}
