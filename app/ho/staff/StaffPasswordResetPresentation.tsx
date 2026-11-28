"use client";
import {useState} from "react";
// PAP-1144 / PAP-2423: local-only representation of existing PAP-1144 confirmation; no live command.
export function StaffPasswordResetAction({busy=false,disabled=false,onClick}:{busy?:boolean;disabled?:boolean;onClick:()=>void}){
 return <button type="button" className="secondary-btn" disabled={busy||disabled} onClick={onClick}>{busy?"Đang reset…":"Reset password"}</button>;
}
export function StaffPasswordResetDescription(){
 return <p>Reset password sẽ thu hồi mật khẩu và phiên đăng nhập hiện tại. Staff phải đổi mật khẩu tạm ở lần đăng nhập tiếp theo.</p>;
}
// Local M1 never receives a credential or executes a reset command.
export function StaffPasswordResetPreview({staffId,email,eligible}:{staffId:string;email:string;eligible:boolean}){
 const [review,setReview]=useState(false);
 return <section className="v24-prop-section" aria-label="Bảo mật tài khoản" data-testid="ho-staff-password-reset-preview">
 <h3>Bảo mật tài khoản</h3><StaffPasswordResetDescription/>
 <p>Dữ liệu mẫu M1. Không thực thi reset hoặc tạo mật khẩu.</p>
 <StaffPasswordResetAction disabled={!eligible||review} onClick={()=>setReview(true)}/>
 {!eligible&&<p role="status">Chỉ reset Staff đang làm và có tài khoản hoạt động được xác minh.</p>}
 {review&&eligible&&<div role="group" aria-label="Xác nhận reset password"><p>Reset password cho {staffId} ({email})?</p><p>Chỉ xem trước xác nhận; không thực thi trong M1.</p><button type="button" className="secondary-btn" onClick={()=>setReview(false)}>Hủy</button> <button type="button" className="primary-btn" disabled>Xác nhận reset</button></div>}
 </section>;
}
