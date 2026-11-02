"use client";
import { useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faBolt, faChevronRight, faDesktop, faDisplay, faGear, faPause, faPlay, faShieldHalved, faStar, faTabletScreenButton, faTv, faUsers, faVolumeHigh, faWandMagicSparkles, faWifi } from "@fortawesome/free-solid-svg-icons";
import StationDesktopFrame from "./StationV4Frame";
import { Initials } from "./OpsInitials";
import {unavailableOpsReadModel,type OpsReadModel} from "@/lib/tos-ops-v4-view-model";
import ops from "./ops.module.css";
import desk from "./station.module.css";

type Tab="overview"|"pinoria"|"students"|"devices"|"tv";
const statusText=(value:string)=>value==="ARRIVED"?"Đang ở PINO":value==="LEFT"?"Đã về":value==="EXPECTED"?"Chưa đến":"Chưa xác minh";
const statusKind=(value:string)=>value==="ARRIVED"?"ok":value==="LEFT"?"left":"waiting";

export function TosVNextStation({onHome,desktop,centerName,model=unavailableOpsReadModel(),initialTab="overview"}:{onHome:()=>void;desktop:boolean;centerName:string;model?:OpsReadModel;initialTab?:Tab}){
 const state=model,guests=model.guests,assetNames=model.assetNames,channels=model.channels,outfits=model.outfits;
 const [tab,setTab]=useState<Tab>(initialTab);
 const [studentId,setStudentId]=useState<string|null>(model.guests[0]?.id??null);
 const [query,setQuery]=useState("");
 const notice="";
 const [deviceMode,setDeviceMode]=useState<"all"|"attention">("all");
 const student=guests.find(g=>g.id===studentId);
 const arrived=guests.filter(g=>state.attendance[g.id]==="ARRIVED");
 const deviceAlerts=assetNames.filter(n=>state.equipment[n]!=="Sẵn sàng").length;
 const wishes=guests.filter(g=>Object.prototype.hasOwnProperty.call(state.wishes,g.id)&&!state.wishes[g.id]).length;
 const filtered=guests.filter(g=>(g.name+" "+g.className+" "+g.room).toLocaleLowerCase("vi").includes(query.toLocaleLowerCase("vi")));
 const navigate=(tab:Tab)=>{setTab(tab);};
 if(!desktop)return <StationDesktopFrame centerName={centerName} tab={tab} onTab={navigate} onHome={onHome} query={query} onQuery={setQuery} onReset={()=>{}} notice=""><p>Trạm TOS chỉ dùng trên máy tính</p></StationDesktopFrame>;
 return <StationDesktopFrame centerName={centerName} tab={tab} onTab={navigate} onHome={onHome} query={query} onQuery={setQuery}
  onReset={()=>{}} notice={notice}>
  {tab==="overview"&&<>
    <div className={desk.metricGrid}>
      <div className={desk.metricCard}><FontAwesomeIcon icon={faUsers}/><strong>{model.loaded?arrived.length:"—"}</strong><span>Học viên tại PINO</span></div>
      <div className={desk.metricCard}><FontAwesomeIcon icon={faStar}/><strong>{model.loaded?wishes:"—"}</strong><span>Wish đang chờ</span></div>
      <div className={desk.metricCard}><FontAwesomeIcon icon={faGear}/><strong>{model.loaded?deviceAlerts:"—"}</strong><span>Thiết bị cần kiểm tra</span></div>
      <div className={desk.metricCard}><FontAwesomeIcon icon={faTv}/><strong>{state.tvPlaying===null?"—":state.tvPlaying?"ON":"OFF"}</strong><span>Trạng thái TV</span></div>
    </div>
    <div className={desk.dashboardGrid}>
      <div className={desk.dashboardMain}>
        <section className={desk.heroStrip}><div><span className={ops.heroKicker}>{centerName} · Chưa xác minh node</span><h2>Trạm TOS</h2><p>Điều phối hoạt động, nội dung trình chiếu và tương tác Pinoria.</p></div><FontAwesomeIcon icon={faWandMagicSparkles}/></section>
        <section className={ops.panel} data-tos-ops="panel"><div className={ops.panelTitle} data-tos-ops="panelTitle"><h3>Thao tác nhanh</h3><span>Workstation</span></div>
          <div className={desk.actionGridDesktop}>
            <button className={desk.quickTile} onClick={()=>navigate("pinoria")}><FontAwesomeIcon icon={faStar}/><span><strong>Pinoria House</strong><small>Wardrobe & vật phẩm</small></span><FontAwesomeIcon icon={faChevronRight}/></button>
            <button className={desk.quickTile} onClick={()=>navigate("tv")}><FontAwesomeIcon icon={faTv}/><span><strong>Trình chiếu TV</strong><small>Chọn chương trình</small></span><FontAwesomeIcon icon={faChevronRight}/></button>
            <button className={desk.quickTile} onClick={()=>navigate("students")}><FontAwesomeIcon icon={faUsers}/><span><strong>Học viên</strong><small>Tra cứu trạng thái</small></span><FontAwesomeIcon icon={faChevronRight}/></button>
            <button className={desk.quickTile} onClick={()=>navigate("devices")}><FontAwesomeIcon icon={faGear}/><span><strong>Thiết bị</strong><small>Báo lỗi và theo dõi</small></span><FontAwesomeIcon icon={faChevronRight}/></button>
          </div>
        </section>
      </div>
      <aside className={desk.dashboardAside}>
        <section className={ops.panel} data-tos-ops="panel"><div className={ops.panelTitle} data-tos-ops="panelTitle"><h3>Hoạt động gần đây</h3><span>{model.loaded?state.events.length:"—"} sự kiện</span></div>
          <div className={ops.activity}>{!model.loaded&&<p>Chưa tải được hoạt động.</p>}{state.events.slice(0,6).map(x=><div className={ops.activityItem} key={x.id}><i className={ops.activityDot}/><span>{x.text}</span><small>{x.time}</small></div>)}</div>
        </section>
        <section className={ops.panel} data-tos-ops="panel"><div className={ops.panelTitle} data-tos-ops="panelTitle"><h3>Trạng thái node</h3><span>Chưa xác minh</span></div><div className={ops.callout} data-tos-ops="callout"><strong><FontAwesomeIcon icon={faWifi}/> Chưa xác minh node</strong><span>Chưa nhận được trạng thái kết nối node.</span></div></section>
      </aside>
    </div>
  </>}
  {tab==="pinoria"&&<>
    <div className={desk.twoColumn}>
      <section className={ops.panel} data-tos-ops="panel"><div className={ops.panelTitle} data-tos-ops="panelTitle"><h3>Chọn học viên</h3><span>{model.loaded?guests.length:"—"} hồ sơ</span></div>
        <div className={desk.studentCards}>{!model.loaded&&<p>Chưa tải được danh sách học viên.</p>}{guests.map(g=><button key={g.id} className={desk.studentChoice} aria-pressed={studentId===g.id} onClick={()=>setStudentId(g.id)}>
          <Initials text={g.initials}/><span><strong>{g.name}</strong><small>{g.className}</small></span>
        </button>)}</div>
      </section>
      <div className={desk.wideColumn}>
        <section className={ops.panel} data-tos-ops="panel"><div className={ops.panelTitle} data-tos-ops="panelTitle"><h3>Pinoria House · {student?.name}</h3><span>Chưa xác minh Region</span></div>
          <div className={desk.previewArtwork}><FontAwesomeIcon icon={faWandMagicSparkles}/><strong>Pinoria House</strong><small>Wardrobe preview · vật phẩm hiện tại: {state.wardrobe[studentId??""]??"Chưa xác minh trang bị"}</small></div>
          <div className={`${ops.row} ${desk.studentSummary}`}><Initials text={student?.initials??"—"}/><div className={ops.rowCopy}><strong>{student?.name}</strong><small>{student?.className}</small></div><span className={ops.badge} data-tos-ops="badge" data-state={state.attendance[studentId??""]}>{statusText(state.attendance[studentId??""])}</span></div>
        </section>
        <section className={ops.panel} data-tos-ops="panel"><div className={ops.panelTitle} data-tos-ops="panelTitle"><h3>Trang bị vật phẩm</h3><span>Chưa xác minh vật phẩm</span></div>
          <div className={desk.itemGrid}>{!model.loaded&&<p>Chưa tải được vật phẩm.</p>}{outfits.map(item=><button key={item} className={ops.option} aria-pressed={state.wardrobe[studentId??""]===item} disabled title="Chưa có command Wardrobe được xác minh">{state.wardrobe[studentId??""]===item?"✓  ":""}{item}</button>)}</div>
        </section>
      </div>
    </div>
    <div className={ops.callout} data-tos-ops="callout"><strong><FontAwesomeIcon icon={faShieldHalved}/> Thao tác chưa khả dụng</strong><span>Trang bị chỉ được cập nhật sau khi có quyền và xác nhận từ hệ thống.</span></div>
  </>}
  {tab==="students"&&<>
    <section className={ops.panel} data-tos-ops="panel">
      <div className={ops.panelTitle} data-tos-ops="panelTitle"><h3>Danh sách học viên</h3><span>{model.loaded?filtered.length:"—"} học viên · lọc bằng ô tìm kiếm phía trên</span></div>
      <div className={desk.dataTableWrap}><table className={desk.dataTable}><thead><tr><th>Học viên</th><th>Lớp học</th><th>Phòng</th><th>Khung giờ</th><th>Trạng thái</th><th>Wardrobe</th></tr></thead>
        <tbody>{filtered.map(g=><tr key={g.id}><td><div className={desk.tableName}><Initials text={g.initials}/><span><strong>{g.name}</strong><small>{g.id}</small></span></div></td>
          <td>{g.className}</td><td>{g.room}</td><td>{g.classTime}</td><td><span className={desk.statusPill} data-kind={statusKind(state.attendance[g.id])}>{statusText(state.attendance[g.id])}</span></td><td>{state.wardrobe[g.id]??"—"}</td></tr>)}</tbody>
      </table>{filtered.length===0?<div className={ops.empty}>{model.loaded?"Không có học viên khớp tìm kiếm.":"Chưa tải được danh sách học viên."}</div>:null}</div>
    </section>
    <div className={ops.callout} data-tos-ops="callout">Chỉ hiển thị thông tin học viên trong phạm vi được cấp quyền.</div>
  </>}
  {tab==="devices"&&<>
    <div className={desk.metricGrid}><div className={desk.metricCard}><FontAwesomeIcon icon={faGear}/><strong>{model.loaded?assetNames.length:"—"}</strong><span>Thiết bị</span></div>
      <div className={desk.metricCard}><FontAwesomeIcon icon={faWifi}/><strong>{model.loaded?assetNames.length-deviceAlerts:"—"}</strong><span>Sẵn sàng</span></div>
      <div className={desk.metricCard}><FontAwesomeIcon icon={faBolt}/><strong>{model.loaded?deviceAlerts:"—"}</strong><span>Cần kiểm tra</span></div>
      <div className={desk.metricCard}><FontAwesomeIcon icon={faDesktop}/><strong>—</strong><span>Node đang xem</span></div></div>
    <section className={ops.panel} data-tos-ops="panel"><div className={ops.panelTitle} data-tos-ops="panelTitle"><h3>Thiết bị tại trạm</h3><span>Chưa có command được xác minh</span></div>
      <div className={`${ops.segment} ${desk.deviceFilter}`}><button aria-pressed={deviceMode==="all"} onClick={()=>setDeviceMode("all")}>Tất cả</button><button aria-pressed={deviceMode==="attention"} onClick={()=>setDeviceMode("attention")}>Cần kiểm tra</button></div>
      <div className={desk.dataTableWrap}><table className={desk.dataTable}><thead><tr><th>Thiết bị</th><th>Node</th><th>Trạng thái</th><th>Loại</th><th>Thao tác</th></tr></thead>
        <tbody>{assetNames.filter(n=>deviceMode==="all"||state.equipment[n]!=="Sẵn sàng").map(name=><tr key={name}>
          <td><div className={desk.tableName}><span className={`${ops.avatar} ${desk.deviceAvatar}`}><FontAwesomeIcon icon={name.includes("TV")?faTv:name.includes("Loa")?faVolumeHigh:name.includes("bảng")?faTabletScreenButton:faBolt}/></span><span><strong>{name}</strong><small>PINO House</small></span></div></td>
          <td>—</td><td><span className={desk.statusPill} data-kind={state.equipment[name]==="Sẵn sàng"?"ok":"alert"}>{state.equipment[name]}</span></td>
          <td>Workstation</td><td><button className={ops.secondary} disabled title="Chưa có command thiết bị được xác minh">{state.equipment[name]==="Sẵn sàng"?"Báo lỗi":"Khôi phục"}</button></td>
        </tr>)}</tbody>
      </table>{deviceMode==="attention"&&deviceAlerts===0?<div className={ops.empty}>{model.loaded?"Không có thiết bị cần kiểm tra.":"Chưa tải được trạng thái thiết bị."}</div>:null}</div>
    </section>
    <div className={ops.callout} data-tos-ops="callout">Không điều khiển thiết bị, không khởi động lại phần cứng hay thay đổi network thật.</div>
  </>}
  {tab==="tv"&&<>
    <div className={desk.twoColumn}>
      <section className={ops.panel} data-tos-ops="panel"><div className={ops.panelTitle} data-tos-ops="panelTitle"><h3>Chương trình TV</h3><span>{model.loaded?channels.length:"—"} nội dung</span></div>
        <div className={desk.tvChannelList}>{!model.loaded&&<p>Chưa tải được danh mục nội dung.</p>}{channels.map((ch,i)=><button key={ch} aria-pressed={state.tvChannel===ch} disabled title="Chưa có command TV được xác minh">{state.tvChannel===ch?"✓ ":""}{i+1}. {ch}</button>)}</div>
      </section>
      <div className={desk.wideColumn}>
        <section className={ops.panel} data-tos-ops="panel"><div className={ops.panelTitle} data-tos-ops="panelTitle"><h3>Xem trước màn hình</h3><span>16:9</span></div>
          <div className={desk.tvPreview}><FontAwesomeIcon icon={faDisplay}/><strong>{state.tvChannel??"Chưa có nội dung được xác minh"}</strong><small>{state.tvPlaying===null?"CHƯA XÁC MINH":state.tvPlaying?"ĐANG PHÁT":"ĐÃ TẠM DỪNG"} · KHÔNG KẾT NỐI TV THẬT</small></div>
          <div className={desk.tvStatus}><span>{state.tvPlaying===null?"Chưa xác minh phát TV":state.tvPlaying?"Đang trình chiếu":"Đã tạm dừng"}</span><button className={`${ops.primary} ${desk.tvPlaybackButton}`} disabled title="Chưa có command TV được xác minh"><FontAwesomeIcon icon={state.tvPlaying?faPause:faPlay}/> {state.tvPlaying?"Tạm dừng":"Bắt đầu trình chiếu"}</button></div>
        </section>
        <div className={ops.callout} data-tos-ops="callout"><strong><FontAwesomeIcon icon={faWifi}/> Chỉ xem trước</strong><span>Không gửi command đến TV player hoặc hệ thống casting thực tế.</span></div>
      </div>
    </div>
  </>}
 </StationDesktopFrame>;
}
