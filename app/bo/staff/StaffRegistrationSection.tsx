"use client";
import {useEffect,useState,useRef} from "react";
import {BoDataGrid,BoDataGridBadge,BoDrawer,type BoDataGridColumn} from "@/app/bo/components/data-grid";
import {BoProperties} from "@/app/bo/components/BoProperties";
import {useBoCenterSelection} from "@/app/bo/components/registration/BoCenterSelection";
import {StaffRegistrationReviewQueue} from "./StaffRegistrationReviewQueue";
import {StaffRegistrationIntakeToggle} from "./StaffRegistrationIntakeToggle";
import {boApi,BoApiError} from "@/lib/bo-api";
import styles from "../bo.module.css";

type RequestRow={id:string;centerId:string;displayLabel:string;submittedAt:string;version:number};
type RoleOption={id:string;displayName:string};

type Mode="approve"|"reject";
const time=(s:string)=>new Date(s).toLocaleString("vi-VN",{timeZone:"Asia/Ho_Chi_Minh"});
const route="workforce/staff-registration-requests";
const path=(p:string,c:string)=>"/api/bo/"+p+"?"+new URLSearchParams({centerId:c}).toString();
async function get<T>(url:string,signal:AbortSignal):Promise<T>{
  const r=await fetch(url,{cache:"no-store",signal});
  const payload=await r.json() as {data?:T;error?:{message?:string}};
  if(!r.ok||payload.data===undefined)throw new BoApiError(r.status,payload.error?.message??"Không thể tải hồ sơ.",r.headers.get("x-request-id"),!!payload.error?.message);
  return payload.data;
}
const columns:BoDataGridColumn<RequestRow>[]=[
  {key:"displayLabel",header:"Họ và tên",render:r=>r.displayLabel,minWidth:180},
  {key:"submittedAt",header:"Ngày gửi",render:r=>time(r.submittedAt),minWidth:160},
  {key:"status",header:"Trạng thái",render:()=> <BoDataGridBadge>Chờ duyệt</BoDataGridBadge>,minWidth:110},
];

// Core's Founder-only intake capability distinguishes the legacy global surface.
// A network failure is not a grant or a reason to fall back to global data.
export function StaffRegistrationSection(){
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
  return <StaffCenterRegistrationReview/>;
}
function StaffCenterRegistrationReview(){
  const scope=useBoCenterSelection();
  const center=scope?.centers.find(c=>c.id===scope.selected);
  if(!scope||scope.loading)return <p role="status">Đang xác thực cơ sở…</p>;
  if(scope.error||!center)return <p role="alert">Chọn cơ sở được cấp quyền.</p>;
  return <CenterReview key={center.id} centerId={center.id} centerName={center.displayName}/>;
}
function CenterReview({centerId,centerName}:{centerId:string;centerName:string}){
  const [rows,setRows]=useState<RequestRow[]>([]);
  const [roles,setRoles]=useState<RoleOption[]>([]);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");
  const [reviewError,setReviewError]=useState("");
  const [reviewReady,setReviewReady]=useState(false);
  const [selected,setSelected]=useState<RequestRow|null>(null);
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
    void get<RequestRow[]>(path(route,centerId),ctl.signal).then(next=>{
      if(ctl.signal.aborted)return;
      if(!Array.isArray(next)||next.some(r=>r.centerId!==centerId||!Number.isSafeInteger(r.version)||r.version<1))throw Error("Dữ liệu cơ sở không hợp lệ.");
      setRows(next);setLoading(false);
    }).catch((cause:unknown)=>{if(!ctl.signal.aborted){setRows([]);setError(cause instanceof Error?cause.message:"Không thể tải hồ sơ.");setLoading(false)}});
    void get<RoleOption[]>(path("workforce/staff-registration-eligible-roles",centerId),ctl.signal).then(next=>{
      if(!ctl.signal.aborted){setRoles(next);setReviewReady(true);}
    }).catch((cause:unknown)=>{if(!ctl.signal.aborted){setRoles([]);setReviewError(cause instanceof Error?cause.message:"Không có quyền duyệt.")}});
    return()=>ctl.abort();
  },[centerId,revision]);
  const canClose=()=>!inFlight.current&&(!roleId&&!reason.trim()||window.confirm("Hủy thay đổi chưa lưu?"));
  const resetSelection=()=>{setSelected(null);setRoleId("");setReason("");};
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
      const response=await fetch(path(route+"/"+encodeURIComponent(selected.id)+"/"+mode,centerId),{
        method:"POST",headers:{"content-type":"application/json","idempotency-key":key},body:JSON.stringify(body)
      });
      const payload=await response.json() as {data?:{registrationRequestId:string;status:string};error?:{message?:string}};
      if(!response.ok||payload.data?.registrationRequestId!==selected.id||payload.data.status!==(mode==="approve"?"APPROVED":"REJECTED"))
        throw Error(payload.error?.message??"Chưa xác nhận được kết quả. Thử lại cùng yêu cầu.");
      setNotice(mode==="approve"?"Đã duyệt hồ sơ.":"Đã từ chối hồ sơ.");
      setRows(current=>current.filter(r=>r.id!==selected.id));
      attempts.current.delete(fingerprint);resetSelection();
      setLoading(true);setReviewReady(false);setReviewError("");refresh(v=>v+1);
    }catch(cause){setError(cause instanceof Error?cause.message:"Chưa xác nhận được kết quả.");}
    finally{inFlight.current=false;setBusy(false)}
  }
  return <section id="staff-registration-review" aria-label="Hồ sơ nhân sự chờ duyệt">
    <div className="page-heading"><div className="page-heading-left"><h1>Hồ sơ chờ duyệt</h1><p>{centerName}</p></div></div>
    {notice?<p role="status">{notice}</p>:null}
    {reviewError?<p role="status">{reviewError}</p>:null}
    {error?<p role="alert">{error}</p>:null}
    <BoDataGrid rows={rows.filter(r=>r.displayLabel.toLocaleLowerCase("vi-VN").includes(search.toLocaleLowerCase("vi-VN")))}
      columns={columns} rowKey={r=>r.id} caption="Hồ sơ nhân sự chờ duyệt" state={loading?"loading":error&&!rows.length?"error":"ready"}
      stateMessage={error} search={search} onSearchChange={setSearch} searchPlaceholder="Tìm tên nhân viên"
      onRowOpen={r=>{if(canClose()){setSelected(r);setRoleId("");setReason("");setError("")}}} quickViewOpener
      emptyTitle="Chưa có hồ sơ" emptyMessage="Không có hồ sơ chờ duyệt trong cơ sở này." resultLabel={rows.length+" hồ sơ"}
      toolbarActions={<button type="button" onClick={()=>{if(canClose()){close();setError("");setReviewError("");setReviewReady(false);setLoading(true);refresh(v=>v+1)}}} disabled={busy}>Tải lại</button>}/>
    {selected?<BoDrawer title={selected.displayLabel} eyebrow="Hồ sơ chờ duyệt" mode="view" busy={busy} canClose={canClose} onClose={close}
      footer={<button className={styles.secondaryButton} type="button" disabled={busy} onClick={requestClose}>Đóng</button>}>
      <BoProperties compact items={[{key:"center",label:"Cơ sở",value:centerName},{key:"date",label:"Ngày gửi",value:time(selected.submittedAt)}]}/>
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
    </BoDrawer>:null}
  </section>;
}
