"use client";
import{useEffect,useMemo,useState}from"react";
import{TosShell}from"@/app/components/tos-shell";
import{workforceApi,WorkforceApiError,type StaffProfile,type WorkforceContext}from"@/lib/workforce-api";
import{tosLearningApi,TosLearningApiError,type DaySession,type LearningOptions,type SessionRoster}from"@/lib/tos-learning-api";
import styles from"./classroom.module.css";

const footer=[{id:"home",label:"Home",href:"/dashboard"},{id:"classroom",label:"Lớp học",href:"/classroom"},{id:"shift",label:"Ca làm",href:"/check-in"},{id:"history",label:"Lịch sử",href:"/timesheet"}];
function dayInZone(timeZone:string){const parts=new Intl.DateTimeFormat("en-CA",{timeZone,year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(new Date()),get=(type:string)=>parts.find(part=>part.type===type)?.value??"";return`${get("year")}-${get("month")}-${get("day")}`;}
function clock(value:string){return value.slice(-5);}
function message(error:unknown){if(error instanceof TosLearningApiError||error instanceof WorkforceApiError){if(error.status===401)return"Phiên đăng nhập không hợp lệ. Vui lòng đăng nhập lại.";if(error.status===403)return"Tài khoản hiện chưa có quyền xem lớp học này.";return error.message;}return error instanceof Error?error.message:"Không thể tải dữ liệu lớp học.";}
function currentSyllabus(options:LearningOptions|null){if(!options)return null;if(options.primarySyllabusId){const primary=options.syllabi.find(item=>item.id===options.primarySyllabusId);if(primary)return primary;}return options.syllabi.find(item=>item.publicationStatus==="PUBLISHED")??options.syllabi[0]??null;}

export default function ClassroomView(){
 const[context,setContext]=useState<WorkforceContext|null>(null),[profile,setProfile]=useState<StaffProfile|null>(null),[centerId,setCenterId]=useState(""),[localDate,setLocalDate]=useState(""),[sessions,setSessions]=useState<DaySession[]>([]),[sessionId,setSessionId]=useState(""),[roster,setRoster]=useState<SessionRoster|null>(null),[options,setOptions]=useState<LearningOptions|null>(null),[loading,setLoading]=useState(true),[error,setError]=useState("");
 const selectedSession=sessions.find(item=>item.id===sessionId)??null;
 const resolved=useMemo(()=>new Map((roster?.resolvedParticipations??[]).map(item=>[item.studentProfileId,item])),[roster]);
 const entries=useMemo(()=>[...(roster?.entries??[])].sort((a,b)=>a.studentDisplayName.localeCompare(b.studentDisplayName,"vi")),[roster]);
 const lessonPlan=currentSyllabus(options);
 async function loadSession(id:string){setSessionId(id);setRoster(null);setOptions(null);if(!id)return;const r=await tosLearningApi.roster(id);setRoster(r.data);try{const o=await tosLearningApi.learningOptions(id);setOptions(o.data);}catch(e){if(e instanceof TosLearningApiError&&e.status===403)return;throw e;}}
 async function loadDay(nextCenter:string,nextDate:string){setLoading(true);setError("");try{const result=await tosLearningApi.sessionsDay(nextCenter,nextDate);setSessions(result.data.sessions);await loadSession(result.data.sessions[0]?.id??"");}catch(e){setError(message(e));setSessions([]);setRoster(null);setOptions(null);}finally{setLoading(false);}}
 // Intentional one-time bootstrap; event handlers own subsequent reloads.
 // eslint-disable-next-line react-hooks/exhaustive-deps
 useEffect(()=>{void(async()=>{setLoading(true);setError("");try{const[c,p]=await Promise.all([workforceApi.context(),workforceApi.profile()]);setContext(c.data);setProfile(p.data);const center=c.data.centers[0];if(!center){setError("Chưa có Center khả dụng cho tài khoản này.");return;}const date=dayInZone(center.timeZone);setCenterId(center.id);setLocalDate(date);await loadDay(center.id,date);}catch(e){setError(message(e));}finally{setLoading(false);}})();},[]);
 async function changeCenter(value:string){setCenterId(value);const center=context?.centers.find(item=>item.id===value),date=center?dayInZone(center.timeZone):localDate;if(center)setLocalDate(date);if(value&&date)await loadDay(value,date);}
 async function changeDate(value:string){setLocalDate(value);if(centerId&&value)await loadDay(centerId,value);}
 async function chooseSession(value:string){setLoading(true);setError("");try{await loadSession(value);}catch(e){setError(message(e));}finally{setLoading(false);}}
 const selectedCenter=context?.centers.find(item=>item.id===centerId)??null;
 return <TosShell title="Lớp học hôm nay" subtitle={selectedCenter?.displayName??profile?.displayLabel??"PINO Team"} theme="classroom" footerItems={footer} activeFooterId="classroom">
  <div className={styles.page}>
   <section className={styles.toolbar}><label>Center<select value={centerId} onChange={event=>void changeCenter(event.target.value)}>{context?.centers.map(center=><option key={center.id} value={center.id}>{center.displayName}</option>)}</select></label><label>Ngày<input type="date" value={localDate} onChange={event=>void changeDate(event.target.value)}/></label></section>
   {error?<div className={styles.error}>{error}</div>:null}
   {loading?<div className={styles.empty}>Đang tải roster an toàn từ Core…</div>:null}
   {!loading&&!sessions.length?<div className={styles.empty}><strong>Không có Session</strong><span>Ngày này chưa có Session materialized cho Center đã chọn.</span></div>:null}
   {sessions.length?<section className={styles.sessionStrip}>{sessions.map(item=><button key={item.id} className={item.id===sessionId?styles.sessionActive:styles.sessionButton} onClick={()=>void chooseSession(item.id)}><strong>{clock(item.scheduledStartsLocal)}–{clock(item.scheduledEndsLocal)}</strong><span>{item.operationalName??item.pathDisplayName}</span><small>{item.learningSpaceDisplayName??item.pathDisplayName}</small></button>)}</section>:null}
   {selectedSession&&roster?<>
    <section className={styles.sessionHeader}><div><span className={styles.eyebrow}>{selectedSession.pathDisplayName}</span><h2>{selectedSession.operationalName??"Session"}</h2><p>{clock(selectedSession.scheduledStartsLocal)}–{clock(selectedSession.scheduledEndsLocal)} · {selectedSession.learningSpaceDisplayName??"Chưa gán phòng"}</p></div><div className={styles.stats}><b>{entries.length}</b><span>expected</span><b>{roster.resolvedParticipations.length}</b><span>Attendance</span></div></section>
    <section className={styles.evidenceBar}><span className={styles.eyebrow}>GIÁO ÁN</span><strong>{lessonPlan?.title??"Chưa có Syllabus khả dụng"}</strong><small>Attendance là dữ liệu vận hành read-only trong Lớp học. Reception/Operations ghi nhận và Core giữ canonical truth.</small></section>
    {roster.unresolvedRegistrations.length?<div className={styles.notice}>{roster.unresolvedRegistrations.length} Registration chưa resolve ở Operations. Lớp học không tự promote hoặc ghi Attendance.</div>:null}
    <section className={styles.roster}>{entries.map(entry=>{const outcome=resolved.get(entry.studentProfileId),source=entry.sources.length===1?entry.sources[0]:null;return <article className={styles.learner} key={entry.studentProfileId}><div className={styles.avatar}>{entry.studentDisplayName.charAt(0).toUpperCase()}</div><div className={styles.identity}><strong>{entry.studentDisplayName}</strong>{outcome?<small>{outcome.basis} · {outcome.commercialConsequence==="CONSUME_SERVICE_UNIT"?"trừ 1 buổi":"không trừ buổi"}</small>:entry.status==="CONFLICT"?<small className={styles.conflict}>Roster conflict · cần xử lý ở Operations</small>:<small>{source?.basis??"Nguồn chưa resolve"} · chờ Attendance canonical</small>}</div>{outcome?<span className={outcome.attendanceStatus==="PRESENT"?styles.present:styles.absent}>{outcome.attendanceStatus==="PRESENT"?"Có mặt":"Vắng"}</span>:<span className={styles.locked}>Chưa ghi</span>}</article>})}</section>
   </>:null}
  </div>
 </TosShell>;
}
