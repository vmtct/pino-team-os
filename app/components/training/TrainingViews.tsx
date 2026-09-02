"use client";

import { useMemo, useState } from "react";
import { TosShell } from "@/app/components/tos-shell";
import styles from "./training.module.css";

const staffModules = [
  { id:"house", icon:"⌂", title:"PINO House Essentials", copy:"Culture, child experience và cách vận hành một buổi ở House.", progress:100, status:"Đã đạt", required:true },
  { id:"diary", icon:"✎", title:"Classroom Diary & Closing", copy:"Checklist cuối buổi, evidence, journal và handoff đúng owner.", progress:62, status:"Cần hoàn tất", required:true },
  { id:"tos", icon:"▣", title:"TOS Day of Learning", copy:"Lớp hôm nay, roster, learning owner và các boundary vận hành.", progress:35, status:"Đang học", required:true },
  { id:"safe", icon:"◇", title:"Child Safety & Safeguarding", copy:"Các nguyên tắc an toàn, escalation và xử lý tình huống với trẻ.", progress:100, status:"Đã đạt", required:true },
];

const trainingFooter = [
  { id:"path", label:"Lộ trình", href:"/training", icon:"◎" },
  { id:"skills", label:"Chứng nhận", href:"/training#skills", icon:"◆" },
] as const;

export function TrainingStaffView({ embedded=false }: { embedded?: boolean }) {
  const [done, setDone] = useState<string[]>([]);
  const modules = staffModules.map((item) => done.includes(item.id) ? { ...item, progress:100, status:"Đã đạt" } : item);
  const content = (
    <div className={styles.staffPage}>
      <section className={styles.hero}>
        <div className={styles.heroTop}>
          <div><p className={styles.eyebrow}>My learning path</p><h2>Skill Passport</h2><p>Hoàn tất các module bắt buộc để sẵn sàng cho đúng context công việc.</p></div>
          <div className={styles.score}><div><strong>3/5</strong><span>qualified</span></div></div>
        </div>
        <div className={styles.progressTrack}><i /></div>
        <div className={styles.heroMeta}><span>Mentor · Cần Thơ</span><span>2 module cần làm</span><span>1 deadline gần</span></div>
      </section>

      <div className={styles.sectionHead}><div><h3>Việc cần học</h3><p>Ưu tiên theo qualification đang thiếu.</p></div><span>4 modules</span></div>
      <section className={styles.moduleList}>
        {modules.map((module) => (
          <article key={module.id} className={styles.moduleCard}>
            <div className={styles.moduleTop}>
              <div className={styles.moduleIcon}>{module.icon}</div>
              <div className={styles.moduleCopy}><strong>{module.title}</strong><small>{module.copy}</small></div>
              <span className={`${styles.badge} ${module.progress===100 ? styles.badgeDone : module.required ? styles.badgeRequired : ""}`}>{module.status}</span>
            </div>
            <div className={styles.moduleProgress}><div className={styles.moduleProgressTrack}><i style={{width:`${module.progress}%`}} /></div><small>{module.progress}%</small></div>
            {module.progress < 100 ? <div className={styles.actionRow}><button className={styles.primaryBtn} type="button" onClick={() => setDone((value) => [...value, module.id])}>Tiếp tục học</button><button className={styles.secondaryBtn} type="button">Xem nội dung</button></div> : null}
          </article>
        ))}
      </section>

      <div id="skills" className={styles.sectionHead}><div><h3>Chứng nhận của tôi</h3><p>Qualification được manager/trainer xác nhận.</p></div></div>
      <section className={styles.skillGrid}>
        <article className={styles.skillCard}><strong>House Ready</strong><small>Có thể tham gia vận hành cơ bản tại PINO House.</small><span className={styles.skillStamp}>● VERIFIED</span></article>
        <article className={styles.skillCard}><strong>Child Safety</strong><small>Đã hoàn tất safeguarding v1.2.</small><span className={styles.skillStamp}>● VERIFIED</span></article>
        <article className={styles.skillCard}><strong>Classroom Operator</strong><small>Còn thiếu Classroom Diary & Closing.</small></article>
        <article className={styles.skillCard}><strong>Learning Owner</strong><small>Cần TOS Day of Learning + trainer sign-off.</small></article>
      </section>
    </div>
  );
  if (embedded) return content;
  return <TosShell title="Đào tạo & Chứng nhận" subtitle="Skill Passport của bạn" theme="tasks" footerItems={[...trainingFooter]} activeFooterId="path">{content}</TosShell>;
}

const seedLessons = [
  "Vì sao Classroom Diary tồn tại",
  "Checklist trước khi đóng Session",
  "Evidence nào được ghi nhận",
  "Escalation khi thiếu dữ liệu",
];

export function TrainingBuilderView() {
  const [lessons, setLessons] = useState(seedLessons);
  const [published, setPublished] = useState(false);
  const [qualification, setQualification] = useState("CLASSROOM_OPERATOR");
  const [title, setTitle] = useState("Classroom Diary & Closing");
  const duration = useMemo(() => lessons.length * 8, [lessons]);
  function addLesson() { setLessons((items) => [...items, `Bài học ${items.length + 1}`]); }
  return (
    <div className={styles.builder}>
      <header className={styles.builderHeader}>
        <div><p className={styles.eyebrow}>WFM-TRAIN · DRAFT MODULE</p><h1>Tạo training</h1><p>Builder tạo phiên bản training cho Staff; qualification chỉ được cấp sau completion + sign-off.</p></div>
        <div className={styles.builderActions}><button className={styles.secondaryBtn} type="button">Lưu nháp</button><button className={styles.primaryBtn} type="button" onClick={() => setPublished(true)}>{published ? "Đã publish v1" : "Review & Publish"}</button></div>
      </header>
      {published ? <div className={styles.notice}>Version 1 đã được đóng băng trong prototype. Assignment mới sẽ tham chiếu đúng version này.</div> : null}

      <div className={styles.builderGrid}>
        <section className={styles.panel}>
          <div className={styles.panelHead}><strong>Nội dung module</strong><small>DRAFT · v1</small></div>
          <div className={styles.formBody}>
            <div className={styles.fieldGrid}>
              <div className={`${styles.field} ${styles.fieldWide}`}><label>Tên training</label><input value={title} onChange={(event) => setTitle(event.target.value)} /></div>
              <div className={styles.field}><label>Track</label><select defaultValue="MENTOR"><option>MENTOR</option><option>TA</option><option>RECEPTION</option><option>ALL STAFF</option></select></div>
              <div className={styles.field}><label>Owner</label><select defaultValue="WORKFORCE"><option>WORKFORCE</option><option>OPERATIONS</option><option>LEARNING</option></select></div>
              <div className={`${styles.field} ${styles.fieldWide}`}><label>Mục tiêu</label><textarea defaultValue="Staff có thể hoàn tất closing flow của lớp, ghi Classroom Diary đúng evidence và biết khi nào cần escalation." /></div>
            </div>
            <div className={styles.sectionHead}><div><h3>Bài học</h3><p>Mỗi bài là một block ngắn, staff làm trực tiếp trên TOS.</p></div><span>{duration} phút</span></div>
            <div className={styles.lessonList}>
              {lessons.map((lesson, index) => <div className={styles.lesson} key={`${lesson}-${index}`}><span className={styles.lessonIndex}>{String(index+1).padStart(2,"0")}</span><div className={styles.lessonCopy}><strong>{lesson}</strong><small>Reading · 8 phút</small></div><button type="button" onClick={() => setLessons((items) => items.filter((_,i)=>i!==index))} aria-label={`Xóa ${lesson}`}>×</button></div>)}
              <button className={styles.addLesson} type="button" onClick={addLesson}>＋ Thêm bài học</button>
            </div>
          </div>
        </section>

        <aside className={styles.sideStack}>
          <section className={styles.panel}><div className={styles.panelHead}><strong>Completion rule</strong><small>F0</small></div><div className={styles.summary}>
            <div className={styles.summaryRow}><span>Yêu cầu</span><strong>100% lessons</strong></div>
            <div className={styles.summaryRow}><span>Assessment</span><strong>Quiz ≥ 80%</strong></div>
            <div className={styles.summaryRow}><span>Sign-off</span><strong>Manager / Trainer</strong></div>
            <div className={styles.qualBox}><small>Qualification outcome</small><strong>{qualification || "Không cấp qualification"}</strong></div>
            <div className={styles.field}><label>Qualification code</label><input value={qualification} onChange={(event)=>setQualification(event.target.value.toUpperCase().replace(/\s+/g,"_"))} /></div>
          </div></section>
          <section className={styles.panel}><div className={styles.panelHead}><strong>Assignment preview</strong><small>6 staff</small></div><table className={styles.matrix}><thead><tr><th>Staff</th><th>Track</th><th>Status</th></tr></thead><tbody>
            <tr><td>Vy</td><td>Mentor</td><td><span className={`${styles.statusDot} ${styles.statusActive}`} />62%</td></tr>
            <tr><td>Phúc</td><td>TA</td><td><span className={styles.statusDot} />Chưa bắt đầu</td></tr>
            <tr><td>Ngọc</td><td>TA</td><td><span className={`${styles.statusDot} ${styles.statusDone}`} />Đã đạt</td></tr>
          </tbody></table></section>
        </aside>
      </div>
    </div>
  );
}

export function TrainingReview() {
  const [surface, setSurface] = useState<"tos"|"bo">("tos");
  return <div className={styles.reviewRoot}><div className={styles.reviewToolbar}><button type="button" className={surface==="tos"?styles.reviewActive:""} onClick={()=>setSurface("tos")}>TOS · Staff</button><button type="button" className={surface==="bo"?styles.reviewActive:""} onClick={()=>setSurface("bo")}>BO · Builder</button></div><div className={surface==="bo"?`${styles.reviewFrame} ${styles.reviewBo}`:styles.reviewFrame}>{surface==="tos"?<TrainingStaffView />:<TrainingBuilderView />}</div></div>;
}
