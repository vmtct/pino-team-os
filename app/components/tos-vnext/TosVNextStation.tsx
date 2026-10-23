"use client";
/**
 * PAP-943: authoritative five-section Desktop station shell.
 * Do not project demo-store user/device/TV data into authenticated runtime.
 */
import {useState} from "react";
import {STATION_DESKTOP_TABS,type StationDesktopTab} from "@/lib/tos-vnext-station";
import {TosVNextCard,TosVNextHeading,TosVNextStatus} from "./TosVNextUI";
import styles from "./tos-vnext.module.css";
const sectionDetail:Record<StationDesktopTab,string>={overview:"Bảng điều phối",pinoria:"House & Wardrobe",students:"Tra cứu & trạng thái",devices:"Quản lý node",tv:"Nội dung trình chiếu"};
const tabCopy:Record<StationDesktopTab,{heading:string;description:string;dependency:string}>={
 overview:{heading:"Tổng quan",description:"Không có chỉ số Station-wide được xác minh từ Core. Bảng điều phối sẽ hiển thị khi API node có quyền truy cập.",dependency:"Workstation node inventory & access"},
 pinoria:{heading:"Pinoria",description:"Không sử dụng Wardrobe hoặc Wish demo làm dữ liệu Core.",dependency:"Authorized Pinoria Ward & inventory API"},
 students:{heading:"Học viên",description:"Không tự sinh bảng danh sách học viên từ dữ liệu prototype.",dependency:"Station-wide Student status & privacy access"},
 devices:{heading:"Thiết bị",description:"Không gửi lệnh điều khiển thiết bị nếu chưa có API, chứng minh quyền và receipt.",dependency:"Node health & device command receipts"},
 tv:{heading:"TV",description:"Không gọi lệnh Play/Pause bằng các API giả, chưa gắn với Pinoria TV Core.",dependency:"TV playback authorization + readback"},
};
export function TosVNextStation({desktop,centerName,onHome}:{
 desktop:boolean;centerName:string;onHome:()=>void;
}){
 const [tab,setTab]=useState<StationDesktopTab>("overview");
 if(!desktop)return <TosVNextCard><p role="alert" className={styles.body}>Trạm TOS chỉ sử dụng trên màn hình desktop rộng từ 1024px.</p><button type="button" className={styles.stationBack} onClick={onHome}>← Về TOS Home</button></TosVNextCard>;
 const copy=tabCopy[tab];
 return <div className={styles.stationShell} data-tos-vnext-station="desktop">
  <aside className={styles.stationSidebar}>
   <div className={styles.stationBrand}><strong>PINO · TRẠM TOS</strong><small>{centerName||"Chưa xác định cơ sở"}</small></div>
   <p className={styles.stationSectionLabel}>KHÔNG GIAN VẬN HÀNH</p>
   <nav aria-label="Điều hướng Trạm TOS">
    {STATION_DESKTOP_TABS.map(item=><button type="button" key={item.id}
     aria-current={item.id===tab?"page":undefined} aria-controls="tos-vnext-station-workspace" onClick={()=>setTab(item.id)}>
     <span><strong>{item.label}</strong><small>{sectionDetail[item.id]}</small></span></button>)}
   </nav>
   <button type="button" className={styles.stationBack} onClick={onHome}>← Về TOS Home</button>
  </aside>
  <main className={styles.stationWorkspace} id="tos-vnext-station-workspace" aria-label="Nội dung Trạm TOS">
   <header className={styles.stationWorkspaceHeader}>
    <div><small>Ứng dụng › {STATION_DESKTOP_TABS.find(item=>item.id===tab)?.label} · {centerName||"Chưa xác định cơ sở"}</small><p className={styles.stationKicker}>TRẠM TOS · WORKSTATION</p><h1>{copy.heading}</h1></div>
    <TosVNextStatus>Đang tích hợp Core</TosVNextStatus>
   </header>
   <section aria-label="Không gian làm việc Trạm TOS" data-station-workspace={tab}>
    <TosVNextHeading title={tab==="overview"?"Tổng quan trạm":tab==="pinoria"?"Pinoria tại trạm":tab==="students"?"Học viên tại trạm":tab==="devices"?"Thiết bị tại trạm":"Màn hình TV"}/>
    {tab==="students"&&<p className={styles.secondary}>Danh sách học viên cần Core kiểm tra quyền truy cập theo trạm.</p>}
    {(tab==="devices"||tab==="tv")&&<p className={styles.secondary}>Chỉ điều khiển sau khi Core xác thực quyền và phản hồi trạng thái thực.</p>}
   </section>
   <div className={styles.stationDashboardGrid}>
    <TosVNextCard><TosVNextHeading title="Trạng thái Core" meta="Chưa xác minh"/>
     <p className={styles.body}>{copy.description}</p>
    </TosVNextCard>
    <TosVNextCard><TosVNextHeading title="Backend cần có" meta="PAP-943"/>
     <p className={styles.secondary}>{copy.dependency}</p>
     <p className={styles.secondary}>Chưa có xác nhận dữ liệu/command trên Production hoặc Staging.</p>
    </TosVNextCard>
   </div>
   {tab==="devices"||tab==="tv"?<TosVNextCard>
    <TosVNextHeading title="Điều khiển"/>
    <button type="button" className={styles.stationDisabledAction} disabled title="Chưa có API điều khiển và xác nhận kết quả từ Core">
     Các lệnh điều khiển chưa khả dụng
    </button>
   </TosVNextCard>:null}
  </main>
 </div>;
}
