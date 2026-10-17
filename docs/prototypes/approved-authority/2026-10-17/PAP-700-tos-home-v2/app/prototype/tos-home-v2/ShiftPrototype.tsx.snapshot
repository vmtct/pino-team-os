"use client";
import { useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faArrowLeft, faCalendarDays, faClock, faWallet, faCircleCheck, faLocationDot, faChevronRight, faTriangleExclamation } from "@fortawesome/free-solid-svg-icons";
import styles from "./shift.module.css";
type Tab = "today" | "calendar" | "hours" | "pay";
const days = [{d:"T2",date:12},{d:"T3",date:13},{d:"T4",date:14},{d:"T5",date:15},{d:"T6",date:16},{d:"T7",date:17},{d:"CN",date:18}];
const shifts = [{date:"12/10",time:"14:00–18:00",station:"Ninh Kiều",hours:"4 giờ",status:"Đã duyệt"},{date:"14/10",time:"18:00–21:00",station:"Ninh Kiều",hours:"3 giờ",status:"Đã duyệt"},{date:"16/10",time:"14:00–18:00",station:"Ninh Kiều",hours:"4 giờ",status:"Chờ xác nhận"}];
export default function ShiftPrototype({onHome}:{onHome:()=>void}) {
 const [tab,setTab]=useState<Tab>("today");
 const [checked,setChecked]=useState(false);
 const [selected,setSelected]=useState(17);
 const [registered,setRegistered]=useState<number[]>([]);
 const [notice,setNotice]=useState("");
 const [adjust,setAdjust]=useState(false);
 const notify=(s:string)=>{setNotice(s);window.setTimeout(()=>setNotice(""),3500)};
 return <main className={styles.shell}><div className={styles.page}>
  <header className={styles.header}><button className={styles.back} onClick={onHome} aria-label="Về TOS Home"><FontAwesomeIcon icon={faArrowLeft}/></button><div className={styles.brand}><img className={styles.brandIcon} src="https://pub-892fa79b018d4d2f9b0808189dd2ce46.r2.dev/AppIcon/shift.png" alt="" /><h1>Ca Làm</h1></div><span className={styles.headerSpacer} aria-hidden="true" /></header>
  <div className={styles.content}>
  {tab==="today"&&<><div className={styles.intro}><span>THỨ BẢY · 17 THÁNG 10</span><h2>Chào Linh, sẵn sàng cho ca hôm nay?</h2><p>Thông tin và thao tác chấm công của bạn.</p></div>
  <section className={styles.hero}><div className={styles.row}><span className={styles.pill}>{checked?"Đang trong ca":"Sắp đến ca"}</span><span>18:00 – 21:00</span></div><h3>Ca Tiếp tân</h3><p><FontAwesomeIcon icon={faLocationDot}/> Station Ninh Kiều</p><p>Tiếp tân · Trưởng ca</p><button className={styles.primary} onClick={()=>{setChecked(!checked);notify(checked?"Đã check-out (mô phỏng).":"Đã check-in (mô phỏng).")}}>{checked?"Check-out":"Check-in"}</button><small>Thao tác mô phỏng · Không ghi dữ liệu thật</small></section>
  <div className={styles.stats}><article><span>Giờ công tháng này</span><strong>32,5 giờ</strong></article><article><span>Ca tiếp theo</span><strong>19/10</strong></article></div>
  <section className={styles.card}><h3>Lưu ý trong ca</h3><p>Kiểm tra thông tin ca trước khi bắt đầu. Nếu có sai lệch, gửi yêu cầu điều chỉnh trong Giờ công.</p></section></>}
  {tab==="calendar"&&<><div className={styles.intro}><span>LỊCH LÀM VIỆC</span><h2>Tháng 10, 2026</h2><p>Chọn ngày để xem hoặc đăng ký ca.</p></div><div className={styles.week}>{days.map(x=><button key={x.date} className={selected===x.date?styles.selected:""} onClick={()=>setSelected(x.date)}><small>{x.d}</small><strong>{x.date}</strong></button>)}</div><section className={styles.card}><div className={styles.row}><h3>Ngày {selected}/10</h3><span className={styles.pill}>{selected===17?"Đã phân công":registered.includes(selected)?"Đã đăng ký":"Chưa có ca"}</span></div>{selected===17?<><p><strong>18:00–21:00</strong> · Station Ninh Kiều</p><p>Tiếp tân + Trưởng ca</p><button className={styles.secondary} onClick={()=>setTab("today")}>Xem ca hôm nay <FontAwesomeIcon icon={faChevronRight}/></button></>:<><p>{registered.includes(selected)?"Đã gửi đăng ký ca (mô phỏng).":"Bạn có thể đăng ký ca cho ngày này."}</p><button className={styles.primary} onClick={()=>{setRegistered(v=>v.includes(selected)?v.filter(x=>x!==selected):[...v,selected]);notify("Đã cập nhật đăng ký ca (mô phỏng).")}}>{registered.includes(selected)?"Hủy đăng ký":"Đăng ký ca 18:00–21:00"}</button></>}</section><section className={styles.card}><h3>Quy trình đăng ký</h3><p>Nhân viên đăng ký thời gian có thể làm. Vai trò trong ca do quản lý phân công sau.</p></section></>}
  {tab==="hours"&&<><div className={styles.intro}><span>GIỜ CÔNG</span><h2>Lịch sử chấm công</h2><p>Kỳ công tháng 10/2026</p></div><div className={styles.stats}><article><span>Đã ghi nhận</span><strong>32,5 giờ</strong></article><article><span>Chờ duyệt</span><strong>4 giờ</strong></article></div><section className={styles.card}><h3>Ca gần đây</h3>{shifts.map(s=><div className={styles.history} key={s.date}><div><strong>{s.date} · {s.time}</strong><p>Station {s.station} · {s.hours}</p></div><span className={styles.smallStatus}>{s.status}</span></div>)}</section><section className={styles.card}><h3>Có sai lệch giờ công?</h3>{adjust?<><label className={styles.label}>Mô tả yêu cầu<textarea placeholder="Ví dụ: quên check-out ca 14/10..." aria-label="Mô tả yêu cầu"/></label><button className={styles.primary} onClick={()=>{setAdjust(false);notify("Đã ghi nhận yêu cầu điều chỉnh (mô phỏng).")}}>Gửi yêu cầu</button></>:<button className={styles.secondary} onClick={()=>setAdjust(true)}>Yêu cầu điều chỉnh</button>}</section></>}
  {tab==="pay"&&<><div className={styles.intro}><span>THU NHẬP</span><h2>Tháng 10/2026</h2><p>Theo dõi thu nhập và lịch sử thanh toán.</p></div><section className={styles.hero}><span className={styles.pill}>Tạm tính · Chưa chốt</span><p>Thu nhập dự kiến</p><div className={styles.money}>1.625.000 ₫</div><p>32,5 giờ × 50.000 ₫/giờ</p><small>Số liệu mẫu, không phải bảng lương thật</small></section><section className={styles.card}><h3>Chi tiết kỳ này</h3><div className={styles.moneyRow}><span>Tiền công cơ bản</span><strong>1.625.000 ₫</strong></div><div className={styles.moneyRow}><span>Điều chỉnh</span><strong>0 ₫</strong></div><div className={styles.moneyRow}><span>Đã thanh toán</span><strong>0 ₫</strong></div><div className={styles.moneyRow}><span>Trạng thái</span><strong>Chưa chốt</strong></div></section><section className={styles.card}><h3>Kỳ lương trước</h3><div className={styles.moneyRow}><span>09/2026 · Đã thanh toán</span><strong>2.100.000 ₫</strong></div></section></>}
  </div>
  <nav className={styles.nav} aria-label="Điều hướng Ca Làm">
  <button aria-current={tab==="today"?"page":undefined} onClick={()=>setTab("today")}><FontAwesomeIcon icon={faCircleCheck}/><span>Hôm nay</span></button>
  <button aria-current={tab==="calendar"?"page":undefined} onClick={()=>setTab("calendar")}><FontAwesomeIcon icon={faCalendarDays}/><span>Lịch ca</span></button>
  <button aria-current={tab==="hours"?"page":undefined} onClick={()=>setTab("hours")}><FontAwesomeIcon icon={faClock}/><span>Giờ công</span></button>
  <button aria-current={tab==="pay"?"page":undefined} onClick={()=>setTab("pay")}><FontAwesomeIcon icon={faWallet}/><span>Thu nhập</span></button>
  </nav>
  {notice&&<div className={styles.toast} role="status"><FontAwesomeIcon icon={faTriangleExclamation}/> {notice}</div>}
 </div></main>;
}
