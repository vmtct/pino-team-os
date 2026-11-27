"use client";
// PAP-2430: local presentation, no real account, credential, transport, or authentication.
import {useId,useState} from "react";
import {initialSecuritySample,sampleCases,sampleAction,simulateInitialEnrollment,type SampleCase,type SecuritySample} from "./staff-security-sample";
const labels:Record<SampleCase,string>={absent:"Chưa có mật khẩu",present:"Đã có mật khẩu",unknown:"Chưa xác minh trạng thái",unlinked:"Chưa liên kết tài khoản",inactive:"Staff hoặc tài khoản không hoạt động",ambiguous:"Liên kết không duy nhất",protected:"Tài khoản Founder được bảo vệ",denied:"Không có quyền"};
export function StaffSecuritySample(){
 const selectId=useId();
 const [state,setState]=useState(()=>initialSecuritySample("absent"));
 const [confirm,setConfirm]=useState<SecuritySample|null>(null);
 const [notice,setNotice]=useState("");
 function change(scenario:SampleCase){setState(initialSecuritySample(scenario));setConfirm(null);setNotice("");}
 function apply(){if(!confirm)return;const next=simulateInitialEnrollment(state,confirm);setConfirm(null);if(!next){setNotice("Không xác minh được thao tác mẫu.");return;}setState(next);setNotice("Đã mô phỏng cấp mật khẩu lần đầu. Cần đổi mật khẩu khi đăng nhập lần đầu.");}
 return <section className="v24-prop-section" aria-label="Bảo mật tài khoản mẫu" data-staff-security-sample>
 <h3>Bảo mật tài khoản (M1)</h3><p>Tình huống giả định, không phải tài khoản của hồ sơ này. Không tạo hoặc hiển thị mật khẩu thật.</p>
 <div className="property-row"><label htmlFor={selectId}>Trạng thái mẫu</label><select id={selectId} className="property-control os-create-select" value={state.scenario} disabled={!!confirm} onChange={e=>change(e.target.value as SampleCase)}>{sampleCases.map(c=><option key={c} value={c}>{labels[c]}</option>)}</select></div>
 <div className="property-row"><span>Tài khoản mẫu</span><span>{state.accountId?"Staff M1 — Access M1":"Không xác định"}</span></div>

 {sampleAction(state)==="initial"&&<button className="primary-btn" type="button" disabled={!!confirm} onClick={()=>{setNotice("");setConfirm({...state});}}>Cấp mật khẩu lần đầu</button>}
 {sampleAction(state)==="reset"&&<><button className="secondary-btn" type="button" disabled>Reset password</button><p>Reset theo quy trình hiện hành; không thực thi trong mẫu này.</p></>}
 {confirm&&<section role="group" aria-label="Xác nhận cấp mật khẩu mẫu"><p>Xác nhận mô phỏng cấp mật khẩu lần đầu cho Staff M1 — Access M1?</p><button className="secondary-btn" type="button" onClick={()=>setConfirm(null)}>Hủy</button><button className="primary-btn" type="button" onClick={apply}>Xác nhận cấp mẫu</button></section>}
 {notice&&<p role="status">{notice}</p>}
 </section>;
}
