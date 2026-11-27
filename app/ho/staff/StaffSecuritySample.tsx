"use client";
// PAP-2430: same hypothetical linked account, no real account or credential transport.
import {useState} from "react";
import {linkedSecuritySample,sampleAction,simulateInitialEnrollment,type SecuritySample} from "./staff-security-sample";
import type {Snapshot} from "./staff-access-presentation-model";
const labels={absent:"Chưa có mật khẩu",present:"Đã có mật khẩu",unknown:"Chưa xác minh trạng thái",unlinked:"Chưa liên kết tài khoản",inactive:"Staff hoặc tài khoản không hoạt động",ambiguous:"Liên kết không duy nhất",protected:"Tài khoản được bảo vệ",denied:"Không có quyền"} as const;
export function StaffSecuritySample({snapshot,loginEmail}:{snapshot:Snapshot;loginEmail:string}){
 const [credential,setCredential]=useState<"absent"|"present">("absent");
 const [confirm,setConfirm]=useState<SecuritySample|null>(null);
 const [notice,setNotice]=useState("");
 const state=linkedSecuritySample(snapshot,credential);
 const action=sampleAction(state);
 const confirming=!!confirm&&confirm.staffId===state.staffId&&confirm.accountId===state.accountId&&confirm.revision===state.revision&&action==="initial";
 function apply(){if(!confirming||!confirm)return;const next=simulateInitialEnrollment(state,confirm);setConfirm(null);if(!next){setNotice("Không xác minh được thao tác mẫu.");return;}setCredential("present");setNotice("Đã mô phỏng cấp mật khẩu lần đầu. Cần đổi mật khẩu khi đăng nhập lần đầu.");}
 return <section className="v24-prop-section" aria-label="Bảo mật tài khoản mẫu" data-staff-security-sample>
 <h3>Bảo mật tài khoản</h3>
 <div className="property-row"><span>Trạng thái mật khẩu</span><span>{labels[state.scenario]}</span></div>
 {action==="initial"&&<button className="primary-btn" type="button" disabled={confirming} onClick={()=>{setNotice("");setConfirm({...state});}}>Cấp mật khẩu lần đầu</button>}
 {action==="reset"&&<><button className="secondary-btn" type="button" disabled>Reset password</button><p>Reset theo quy trình hiện hành; không thực thi trong mẫu này.</p></>}
 {confirming&&<section role="group" aria-label="Xác nhận cấp mật khẩu mẫu"><p>Xác nhận mô phỏng cấp mật khẩu lần đầu cho {loginEmail}?</p><button className="secondary-btn" type="button" onClick={()=>setConfirm(null)}>Hủy</button><button className="primary-btn" type="button" onClick={apply}>Xác nhận cấp mẫu</button></section>}
 {notice&&action==="reset"&&<p role="status">{notice}</p>}
 </section>;
}
