"use client";
// PAP-1884 / Epic PAP-1832 PNR-IDENTITY — prototype-only phone/PIN first-login.
 // Never sends credentials, creates sessions or reads/writes Core.
import {useState,type FormEvent} from "react";
import Link from "next/link";
import css from "../../../launcher.module.css";
type Scenario="first"|"existing"|"expired"|"locked";
type Stage="login"|"change"|"complete";
export default function AfterschoolPinDemo({returnTo}:{returnTo:string}){
 const [scenario,setScenario]=useState<Scenario>("first");
 const [stage,setStage]=useState<Stage>("login");
 const [phone,setPhone]=useState("");
 const [pin,setPin]=useState("");
 const [nextPin,setNextPin]=useState("");
 const [confirm,setConfirm]=useState("");
 const [message,setMessage]=useState("");
 const reset=(value:Scenario)=>{
  setScenario(value);setStage("login");setPhone("");setPin("");setNextPin("");setConfirm("");setMessage("");
 };
 const request=(event:FormEvent<HTMLFormElement>)=>{
  event.preventDefault();setMessage("");
  if(!/^0[35789]\d{8}$/.test(phone.replace(/\s/g,""))){setMessage("Vui lòng nhập số điện thoại hợp lệ.");return;}
  if(!/^\d{6}$/.test(pin)){setMessage("PIN gồm đúng 6 chữ số.");return;}
  if(scenario==="expired"){setMessage("PIN tạm đã hết hạn (demo). Vui lòng liên hệ PINO để được cấp lại.");setPin("");return;}
  if(scenario==="locked"){setMessage("Tài khoản đang tạm khóa 15 phút do nhập sai nhiều lần (demo).");setPin("");return;}
  setPin("");
  if(scenario==="first"){setStage("change");return;}
  setStage("complete");
 };
 const change=(event:FormEvent<HTMLFormElement>)=>{
  event.preventDefault();setMessage("");
  if(!/^\d{6}$/.test(nextPin)){setMessage("PIN mới phải gồm đúng 6 chữ số.");return;}
  if(nextPin!==confirm){setMessage("Hai lần nhập PIN mới chưa khớp.");return;}
  setNextPin("");setConfirm("");setStage("complete");
 };
 const isFirst=stage==="change";
 return <section className={css.guestLoginCard} data-pin-prototype="PAP-1884" data-pin-stage={stage}>
  <div className={css.guestLoginIcon} aria-hidden="true">✿</div>
  <h1>{isFirst?"Tạo PIN mới":stage==="complete"?"Sẵn sàng khám phá":"PINO Afterschool"}</h1>
  <p>{isFirst?"Lần đầu đăng nhập, con và gia đình cần đổi PIN tạm trước khi mở hành trình riêng.":
   stage==="complete"?"Đã hoàn thành luồng minh họa. Phiên đăng nhập thật chưa được tạo.":
   "Hết giờ học, đến giờ con khám phá. Dành cho tài khoản Parent đã được PINO cấp."}</p>
  <div className={css.pinDemoBadge}>MÔ PHỎNG · Không lưu, không gửi PIN · Không kết nối Core</div>
  {stage==="login"&&<>
   <label htmlFor="pin-scenario">Kiểm thử tình huống</label>
   <select id="pin-scenario" className={css.pinDemoSelect} value={scenario}
    onChange={e=>reset(e.target.value as Scenario)}>
    <option value="first">Lần đầu dùng PIN tạm</option>
    <option value="existing">Đã có PIN riêng</option>
    <option value="expired">PIN tạm hết hạn</option>
    <option value="locked">Tài khoản tạm khóa</option>
   </select>
   <form className={css.pinDemoForm} onSubmit={request}>
    <label htmlFor="pin-phone">Số điện thoại Parent</label>
    <input id="pin-phone" name="phone" type="tel" inputMode="tel" autoComplete="off"
     placeholder="09xx xxx xxx" value={phone} onChange={e=>setPhone(e.target.value)}
     maxLength={15} required/>
    <label htmlFor="pin-current">PIN {scenario==="first"?"tạm thời":"của bạn"}</label>
    <input id="pin-current" name="pin" type="password" inputMode="numeric" autoComplete="off"
     placeholder="6 chữ số" value={pin} onChange={e=>setPin(e.target.value.replace(/\D/g,"").slice(0,6))}
     pattern="[0-9]{6}" maxLength={6} required/>
    <button type="submit" className={css.pinDemoPrimary}>Tiếp tục</button>
   </form>
  </>}
  {isFirst&&<form className={css.pinDemoForm} onSubmit={change}>
   <div className={css.pinDemoNotice} role="status">PIN tạm chỉ dùng để xác minh lần đầu. Bạn phải đổi PIN mới trước khi truy cập thông tin học viên.</div>
   <label htmlFor="pin-new">PIN mới (6 chữ số)</label>
   <input id="pin-new" name="new-pin" type="password" inputMode="numeric" autoComplete="new-password"
    placeholder="6 chữ số" value={nextPin} onChange={e=>setNextPin(e.target.value.replace(/\D/g,"").slice(0,6))}
    pattern="[0-9]{6}" maxLength={6} required/>
   <label htmlFor="pin-confirm">Nhập lại PIN mới</label>
   <input id="pin-confirm" name="confirm-pin" type="password" inputMode="numeric" autoComplete="new-password"
    placeholder="Nhập lại PIN mới" value={confirm} onChange={e=>setConfirm(e.target.value.replace(/\D/g,"").slice(0,6))}
    pattern="[0-9]{6}" maxLength={6} required/>
   <button type="submit" className={css.pinDemoPrimary}>Lưu PIN mới (demo)</button>
   <button type="button" className={css.pinDemoSecondary} onClick={()=>reset(scenario)}>Trở lại</button>
  </form>}
  {stage==="complete"&&<div className={css.pinDemoSuccess} role="status">
    <strong>Hoàn tất luồng đăng nhập mẫu</strong>
    <p>Ở bản thật, chỉ sau khi Core xác thực và đổi PIN thành công, Parent mới truy cập được hồ sơ các bé theo quyền Guardian/Center.</p>
    <button type="button" className={css.pinDemoSecondary} onClick={()=>reset("first")}>Thử lại lần đầu</button>
   </div>}
  {message&&<div role="alert" className={css.pinDemoError}>{message}</div>}
  <small>Quên PIN hoặc PIN tạm hết hạn? Liên hệ PINO để xác minh danh tính và cấp PIN mới. Không có đăng ký công khai.</small>
  <Link href={returnTo} className={css.guestLoginBack}>‹ Quay lại trang công khai</Link>
 </section>;
}
