"use client";
/** PAP-946 V4 presentation. Registration/certificate truth comes only from supplied Core reads. */
import {AppBottomNav,AppSheet,AppButton,AppSectionHeading} from "../tos-ds";
import type {TrainingV5CatalogItem,TrainingV5Registration,TrainingV5Eligibility} from "@/lib/tos-training-v5-api";
import type {StaffQualification} from "@/lib/training-model";
import {safeTrainingGuideUrl} from "@/lib/tos-training-guide-url";
import css from "./training.module.css";
export type TrainingV4Props={
 tab:"progress"|"certificates";onTab:(tab:"progress"|"certificates")=>void;
 search:string;onSearch:(value:string)=>void;path:string;onPath:(value:string)=>void;
 filter:string;onFilter:(value:string)=>void;
 catalog:TrainingV5CatalogItem[];registrations:TrainingV5Registration[];qualifications:StaffQualification[];
 selected:TrainingV5CatalogItem|null;onSelect:(item:TrainingV5CatalogItem|null)=>void;
 busy:boolean;error:string;certBusy:boolean;certError:string;eligibility:TrainingV5Eligibility|null;eligibilityBusy:boolean;eligibilityError:string;
 total:number;offset:number;onOffset:(value:number)=>void;onRetry:()=>void;onCertRetry:()=>void;
};
const registrationLabel:Record<TrainingV5Registration["status"],string>={REQUESTED:"Đã gửi đăng ký",ACCEPTED:"Đã chấp nhận",IN_TRAINING:"Đang học",COMPLETED:"Hoàn thành",CANCELLED:"Đã hủy"};
export default function TrainingV4Presentation(p:TrainingV4Props){
 const paths=["",...new Set([...p.catalog.map(x=>x.path),...(p.path?[p.path]:[])])];
 const record=(id:string)=>p.registrations.find(row=>row.moduleId===id&&row.status!=="CANCELLED");
 const visible=p.catalog.filter(item=>p.search.trim()||item.popular).sort((a,b)=>a.popularityRank-b.popularityRank);
 return <><div className={css.bodyScroll}>
  {p.tab==="progress"?<>
   <div className={css.field}><label htmlFor="training-v4-search">Tìm training</label><input id="training-v4-search" type="search" placeholder="Mã hoặc tên Training..." value={p.search} onChange={e=>p.onSearch(e.target.value)}/></div>
   <div className={css.chips}>{paths.map(path=><button type="button" key={path} aria-pressed={p.path===path} className={p.path===path?css.chipActive:""} onClick={()=>p.onPath(path)}>{path||"Tất cả"}</button>)}</div>
   <AppSectionHeading title="Training Library" meta={p.busy?"Đang tải…":p.error?"Chưa tải được":visible.length+" chương trình"}/>
   {p.busy&&<p role="status">Đang tải danh mục…</p>}
   {p.error&&<div role="alert"><p>{p.error}</p><AppButton variant="secondary" onClick={p.onRetry}>Thử tải lại</AppButton></div>}
   {!p.busy&&!p.error&&visible.map(item=><button type="button" key={item.moduleId} className={css.courseRow} onClick={()=>p.onSelect(item)}><span className={css.courseIcon}>✧</span><span className={css.courseText}><strong>{item.title}</strong><small>{item.summary}</small><i>{item.path} · {item.code}</i></span><span className={css.courseState}>{record(item.moduleId)?registrationLabel[record(item.moduleId)!.status]:"Mở xem"}</span></button>)}
   {!p.busy&&!p.error&&visible.length===0&&<p className={css.empty}>Không tìm thấy Training phù hợp.</p>}
   {!p.busy&&!p.error&&(p.total>30||p.offset>0)&&<div><AppButton variant="secondary" disabled={p.offset===0} onClick={()=>p.onOffset(Math.max(0,p.offset-30))}>Trang trước</AppButton><AppButton variant="secondary" disabled={p.offset+30>=p.total} onClick={()=>p.onOffset(p.offset+30)}>Trang sau</AppButton></div>}
  </>:<>
   <AppSectionHeading title="Chứng Nhận" meta="Đăng ký & hoàn thành"/>
   <div className={css.chips}>{["Tất cả","Đang đăng ký","Hoàn thành"].map(filter=><button type="button" key={filter} aria-pressed={p.filter===filter} className={p.filter===filter?css.chipActive:""} onClick={()=>p.onFilter(filter)}>{filter}</button>)}</div>
   {p.error&&<p role="alert">{p.error}</p>}
   <AppSectionHeading title="Danh sách" meta="Chứng nhận Core hiện hữu (F0)"/>
   {p.certBusy&&<p role="status">Đang tải chứng nhận…</p>}
   {p.certError&&<div role="alert"><p>{p.certError}</p><AppButton variant="secondary" onClick={p.onCertRetry}>Thử tải lại chứng nhận</AppButton></div>}
   {!p.certBusy&&!p.certError&&p.qualifications.filter(()=>p.filter!=="Đang đăng ký").map(cert=><article className={css.courseRow} key={cert.id}><span className={css.courseIcon}>♙</span><span className={css.courseText}><strong>{cert.qualificationCode}</strong><small>{cert.grantedAt}{cert.expiresAt?" · "+cert.expiresAt:""}</small></span><span className={css.courseState}>{cert.status}</span></article>)}
   {p.filter!=="Hoàn thành"&&p.registrations.filter(row=>row.status!=="CANCELLED"&&row.status!=="COMPLETED").map(row=>{const item=p.catalog.find(x=>x.moduleId===row.moduleId);return <button type="button" className={css.courseRow} key={row.id} disabled={!item} onClick={()=>item&&p.onSelect(item)}><span className={css.courseIcon}>♙</span><span className={css.courseText}><strong>{item?.title??row.moduleId}</strong><small>{item?.path??"Chưa tải tên chương trình"}</small></span><span className={css.courseState}>{registrationLabel[row.status]}</span></button>})}
   {!p.certBusy&&!p.certError&&p.qualifications.length===0&&p.registrations.length===0&&<div className={css.empty}>Chưa có chứng nhận Core hiện hữu. Đăng ký V5 chưa được xác minh.</div>}
  </>}
 </div>
 <AppBottomNav label="Thăng Tiến" items={[{id:"progress",label:"Thăng Tiến",icon:"▤"},{id:"certificates",label:"Chứng Nhận",icon:"✧"}]} active={p.tab} onChange={id=>p.onTab(id as TrainingV4Props["tab"])}/>
 {p.selected&&<AppSheet title={p.selected.title} label={"Training "+p.selected.title} onClose={()=>p.onSelect(null)}>
  <span className={css.miniState}>{p.selected.code} · {p.selected.path}</span><p>{p.selected.description||p.selected.summary}</p>
  <p className={css.minimumHours}>Giờ đã làm tối thiểu: <strong>{p.selected.minHours} giờ</strong></p>
  <div className={css.field}><span>Chứng nhận tiên quyết</span>{p.selected.prerequisiteModuleIds.length?p.selected.prerequisiteModuleIds.map(id=>{const item=p.catalog.find(x=>x.moduleId===id);return <button type="button" key={id} className={css.prereq} disabled={!item} onClick={()=>item&&p.onSelect(item)}>{item?.title??id} ↗</button>}):<p>Không có</p>}</div>
  {p.eligibilityBusy&&<p role="status">Đang kiểm tra điều kiện…</p>}{p.eligibilityError&&<p role="alert">{p.eligibilityError}</p>}
  {p.eligibility&&<p>{p.eligibility.eligible?"Đủ điều kiện":"Chưa đủ điều kiện"} · {p.eligibility.confirmedHours}/{p.eligibility.requiredHours} giờ xác nhận</p>}
  {safeTrainingGuideUrl(p.selected.guideUrl)&&<a href={safeTrainingGuideUrl(p.selected.guideUrl)!} target="_blank" rel="noopener noreferrer">Mở hướng dẫn</a>}
  <p className={css.hint}>Hoàn thành được xác nhận tại BO · Training Register. Đăng ký chưa mở; không tự phát chứng nhận.</p>
  <AppButton className={record(p.selected.moduleId)?css.secondary:css.primary} disabled title="Chưa xác minh Core V5 WRITE">{record(p.selected.moduleId)?.status==="COMPLETED"?"Hoàn thành":record(p.selected.moduleId)?"Hủy đăng ký":"Đăng ký"}</AppButton>
  <AppButton variant="secondary" className={css.secondary} onClick={()=>p.onSelect(null)}>Đóng</AppButton>
 </AppSheet>}
 </>;
}
