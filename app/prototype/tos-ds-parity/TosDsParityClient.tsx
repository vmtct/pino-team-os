"use client";
import {useState} from "react";
import {AppFrame,AppHeader,AppContent,AppSectionHeading,AppCard,AppButton,
 AppSheet,AppField,AppStatusBadge,AppBottomNav,AppIconButton} from "@/app/components/tos-ds";
import type {TosVNextAppId} from "@/app/components/tos-ds";

/** PAP-1014 smoke fixture: synthetic UI only, NO staff identity or Core calls. */
export default function TosDsParityClient(){
 const [app,setApp]=useState<TosVNextAppId>("shift");
 const [tab,setTab]=useState("today"),[showSheet,setShowSheet]=useState(false);
 const desktop=app==="station";
 return <div data-pap1014-ds-parity>
  <div style={{maxWidth:430,margin:"8px auto",display:"flex",gap:8,alignItems:"center"}}>
   <label htmlFor="parity-app">Theme</label>
   <select id="parity-app" value={app} onChange={e=>setApp(e.target.value as TosVNextAppId)}>
    <option value="shift">Ca Làm</option><option value="reception">Tiếp Tân</option>
    <option value="station">Trạm TOS</option><option value="shift-lead">Trưởng Ca</option>
    <option value="classroom">Lớp Học</option><option value="training">Thăng Tiến</option>
   </select>
  </div>
  <AppFrame app={app} mode={desktop?"desktop":"mobile"}>
   <AppHeader app={app} station="PINO House · DS fixture" onHome={()=>setApp("shift")}/>
   <AppContent>
    <AppSectionHeading title="TOS Design System" meta="PAP-1014 · V2"/>
    <AppCard><AppSectionHeading title="Trạng thái" meta="Core-independent"/>
     <p>Học viên và ca làm chỉ là bản mẫu UI, không có ghi nhận nghiệp vụ.</p>
     <AppStatusBadge kind="success">Đã xác minh</AppStatusBadge>{" "}
     <AppStatusBadge kind="warning">Đang kiểm tra</AppStatusBadge>
    </AppCard>
    <AppCard><AppSectionHeading title="Thao tác" meta="44px min"/>
     <div style={{display:"flex",gap:8,flexWrap:"wrap",marginTop:16}}>
      <AppButton onClick={()=>setShowSheet(true)}>Mở sheet</AppButton>
      <AppButton variant="secondary">Secondary</AppButton>
      <AppButton variant="quiet">Quiet</AppButton>
      <AppButton variant="destructive">Delete (demo)</AppButton>
      <AppIconButton label="Trợ giúp">?</AppIconButton>
     </div>
    </AppCard>
    <AppCard><AppField label="Ghi chú" hint="Demo-only, không lưu thông tin cá nhân">
     <input type="text" placeholder="Nội dung mẫu"/>
    </AppField></AppCard>
   </AppContent>
   {!desktop&&<AppBottomNav label="Demo tabs" active={tab} onChange={setTab}
    items={[{id:"today",label:"Hôm nay",icon:"◉"},{id:"history",label:"Lịch sử",icon:"▦"}]}/>}
   {showSheet&&<AppSheet title="TOS AppSheet" onClose={()=>setShowSheet(false)}>
    <p>Kiểm tra bàn phím, giới hạn vùng cuộn và focus.</p>
    <AppButton onClick={()=>setShowSheet(false)}>Xác nhận</AppButton>
   </AppSheet>}
  </AppFrame>
 </div>
}
