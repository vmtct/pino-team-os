"use client";
import {useEffect,useMemo,useRef,useState} from "react";
import {readClassOpening,confirmClassOpening,appendClassOpening,classOpeningPhoto,newOpeningRequestKey,type ClassOpeningScope,type ClassOpeningSnapshot} from "@/lib/tos-class-opening-client";
import {FontAwesomeIcon,faArrowLeft,faBookOpen,faCalendarDays,faCamera,faCheck,faChevronRight,faCircleCheck,faClipboardList,faClock,faFlag,faGraduationCap,faInfoCircle,faLink,faMagnifyingGlass,faMusic,faPalette,faPlay,faPlus,faRotate,faStar,faTriangleExclamation,faUserPlus,faUsers,faXmark} from "./classroom-icons";
import type {IconDefinition} from "./classroom-icons";
import styles from "./classroom.module.css";
import MissionAssignmentTab from "./MissionAssignmentTab";
import {searchClassroomStudents,addClassroomStudent,type RosterCandidate} from "@/lib/tos-classroom-roster";
import DiaryCapturePanel from "./DiaryCapturePanel";
import {formatPinoDateTime} from "@/lib/pino-datetime";
import {saveExistingClassroomDiary} from "@/lib/tos-classroom-diary-editor";
import {isDiaryStagingWriterHost} from "@/lib/tos-diary-stage-admission";
import {createSlotKeys} from "../tos-ds";
const tosSlotKeys=createSlotKeys(styles);
import {AppNavShell,AppModalRoot,AppToast} from "../tos-ds";

import {evidenceRounds,lastRound,reviewState,reviewText,needsAction,validateClassroomDraft,type Tab,type Domain,type Gender,type Student,type ScheduledClass,type Mission,type Evidence,type DiaryMission,type Diary,type OpeningPhoto,type ClassroomV4ViewModel,type ClassroomV4InitialView} from "@/lib/tos-classroom-v4-view-model";
function PrivateClassOpeningImage({scope,receiptId,assetId,alt}:{scope:ClassOpeningScope;receiptId:string;assetId:string;alt:string}){
 const [src,setSrc]=useState(""),[error,setError]=useState(false);
 const {centerId,runningClassId,localDate}=scope;
 useEffect(()=>{
  const controller=new AbortController();
  void classOpeningPhoto({centerId,runningClassId,localDate},receiptId,assetId,controller.signal).then(value=>{
   if(!controller.signal.aborted)setSrc(value);
  }).catch(()=>{if(!controller.signal.aborted)setError(true);});
  return()=>controller.abort();
 },[centerId,runningClassId,localDate,receiptId,assetId]);
 // Existing proof gallery uses the same image element; bytes fetched through authorized RPC.
 // eslint-disable-next-line @next/next/no-img-element
 return src?<img src={src} alt={alt}/>:<p role="status">{error?"Không thể xác minh ảnh.":"Đang tải ảnh…"}</p>;
}
const dateLabel=(s:string)=>{const p=s.slice(0,10).split("-");return p.length===3?p[2]+"/"+p[1]:"—"};
const timeLabel=(s:string)=>s.includes("T")?s.slice(11,16):"—";
const interactionOptions=[{value:1,label:"Không hợp tác và phản kháng",short:"Phản kháng"},{value:2,label:"Hoàn thành không tương tác",short:"Không tương tác"},{value:3,label:"Hoàn thành buổi học có tương tác",short:"Có tương tác"},{value:4,label:"Hứng thú và đào sâu",short:"Hứng thú, đào sâu"}] as const;
const interestText=(value:number|null,closedAt?:string)=>value===null?"Chưa đánh giá":closedAt&&closedAt.slice(0,10)<"2026-10-19"?value+"/5 (thang cũ)":interactionOptions.find(o=>o.value===value)?.label||"Mức "+value+"/5 (thang cũ)";
const plsText=(m?:Mission)=>m?.plsValue===undefined?"— PLS":m.plsValue+" PLS";
const diaryFormSignature=(results:Record<string,boolean|null>,interest:number|null,notes:string,difficulty:string,evidence:Evidence[])=>JSON.stringify([Object.entries(results).sort(),interest,notes,difficulty,evidence.map(e=>[e.name,e.kind,e.preview?.length||0])]);
const icon=(subject:Domain):IconDefinition=>subject==="art"?faPalette:subject==="piano"?faMusic:faBookOpen;
// PAP-1488 / Epic PAP-1188 / featureId tos-student-mission-assignment.
// Team Surface Decision: TOS, MOBILE, LOP_HOC; existing classroom entry, green theme,
// footer [Học viên, Nhiệm vụ, Nhật ký]; primary action read Assignments; capture NONE.
// BO layout NONE; Core session.roster.view + Center/occurrence/CANDIDATE scope;
// cross-domain links NONE; founder_layout_review APPROVED. PAP-945 owns the mount.
export default function ClassroomV4Presentation({model,initialView,onDetailChange,onRosterChanged,readOnly=false}:{model:ClassroomV4ViewModel;initialView?:ClassroomV4InitialView;onDetailChange?:(open:boolean)=>void;onRosterChanged?:(classId:string,studentId:string)=>Promise<void>;readOnly?:boolean}){
 const classes=model.classes,catalog=model.missions,staff=model.staffLabel;
 const mission=(id:string)=>catalog.find(item=>item.id===id);
 const blocked=()=>notify("Chức năng chưa khả dụng. Chưa gửi hoặc lưu dữ liệu.");
 const [diaryEdits,setDiaryEdits]=useState<Record<string,Diary>>({});
 const [openingSnapshots,setOpeningSnapshots]=useState<Record<string,ClassOpeningSnapshot|undefined>>({});
 const openingWriteLock=useRef(false),appendWriteLock=useRef(false);
 const openingGeneration=useRef(0);
 const classScope=(c:ScheduledClass)=>({centerId:model.centerId,runningClassId:c.runningClassId,localDate:model.today});
 useEffect(()=>{
  const generation=++openingGeneration.current,controller=new AbortController();
  for(const c of classes)void readClassOpening({centerId:model.centerId,runningClassId:c.runningClassId,localDate:model.today},controller.signal)
   .then(snapshot=>{if(controller.signal.aborted||generation!==openingGeneration.current)return;
    setOpeningSnapshots(prev=>{
     if((prev[c.id]?.opening?.version??0)>(snapshot.opening?.version??0))return prev;
     return {...prev,[c.id]:snapshot};
    });
   }).catch(()=>{if(!controller.signal.aborted&&generation===openingGeneration.current)setOpeningSnapshots(prev=>({...prev,[c.id]:undefined}));});
  return()=>{controller.abort();};
 },[model.centerId,model.today,classes]);
 const data=useMemo(()=>{
  const openings={...model.data.openings};
  for(const c of model.classes){
   const snapshot=openingSnapshots[c.id];
   if(snapshot){if(snapshot.opening)openings[c.id]=snapshot.opening;else delete openings[c.id];}
  }
  return {...model.data,openings,diaries:model.data.diaries.map(d=>diaryEdits[d.id]??d)};
 },[model.data,model.classes,diaryEdits,openingSnapshots]);
 const [diaryWriting,setDiaryWriting]=useState(false);
 const diaryWriteLock=useRef(false);
 const [diaryHostAdmitted,setDiaryHostAdmitted]=useState(false);
 useEffect(()=>{setDiaryHostAdmitted(isDiaryStagingWriterHost(process.env.NEXT_PUBLIC_PINO_DIARY_STAGING_WRITE==="true",window.location.hostname));},[]);
 const [session,setSession]=useState(initialView?.classId??"");const [tab,setTab]=useState<Tab>(initialView?.tab??"students");
 const classContentRef=useRef<HTMLDivElement|null>(null);
 const [missionCreateRequest,setMissionCreateRequest]=useState<{id:number;studentId:string}|null>(null);
 const missionCreateSequence=useRef(0);
 useEffect(()=>{onDetailChange?.(!!session)},[session,onDetailChange]);
 const [opening,setOpening]=useState(initialView?.openingClassId??"");const [openingImage,setOpeningImage]=useState("");const [openingBusy,setOpeningBusy]=useState(false);
 const [bypassConfirm,setBypassConfirm]=useState(false);
 // Explicit per-entry SKIP; never inferred from a deep link or missing opening record.
 const [confirmedSkipClassId,setConfirmedSkipClassId]=useState("");
 const [overlay,setOverlay]=useState<""|"student"|"historyDetail"|"add"|"assign"|"guide"|"diary"|"photo">(initialView?.overlay??"");
 const [proofClassId,setProofClassId]=useState(initialView?.classId??"");
 const [appendOpen,setAppendOpen]=useState(false);
 const [draftPhotos,setDraftPhotos]=useState<OpeningPhoto[]>([]);
 const [draftNote,setDraftNote]=useState("");
 const [appendBusy,setAppendBusy]=useState(false);
 const appendRetry=useRef<{signature:string;key:string}|null>(null);
 const [studentId,setStudentId]=useState(initialView?.studentId??model.data.students[0]?.id??"");const [addMode,setAddMode]=useState<"existing"|"lead">("existing");const [lookup,setLookup]=useState("");const [newName,setNewName]=useState("");const [newAge,setNewAge]=useState("");const [newGender,setNewGender]=useState<Gender>("Nữ");
 const [missionSearch,setMissionSearch]=useState("");const [chosenMission,setChosenMission]=useState("");const [replacingDiaryId,setReplacingDiaryId]=useState("");const [replacingMissionId,setReplacingMissionId]=useState("");const [appendDiaryId,setAppendDiaryId]=useState("");const [selectedMissionId,setSelectedMissionId]=useState(initialView?.missionId??"");
 const [selectedDiary,setSelectedDiary]=useState(initialView?.diaryId??"");const [missionResults,setMissionResults]=useState<Record<string,boolean|null>>({});const [interest,setInterest]=useState<number|null>(null);const [difficulty,setDifficulty]=useState("");const [notes,setNotes]=useState("");const [evidence,setEvidence]=useState<Evidence[]>([]);const [formErrors,setFormErrors]=useState<string[]>([]);const [uploading,setUploading]=useState(false);
 const [diaryInitialSnapshot,setDiaryInitialSnapshot]=useState("");const [discardConfirm,setDiscardConfirm]=useState(false);const sheetRef=useRef<HTMLElement|null>(null);
 const [missionGateDiaryId,setMissionGateDiaryId]=useState("");
 const [message,setMessage]=useState("");const [diaryStateFilter,setDiaryStateFilter]=useState<"all"|"REGISTERED"|"CLOSED">("all");
 useEffect(()=>{if(!message)return;const t=setTimeout(()=>setMessage(""),3200);return()=>clearTimeout(t)},[message]);
 useEffect(()=>{
  if(!missionGateDiaryId)return;
  const timer=window.setTimeout(()=>document.querySelector<HTMLButtonElement>('[data-mission-gate-close]')?.focus(),0);
  const onKey=(e:KeyboardEvent)=>{if(e.key==="Escape"){e.preventDefault();e.stopPropagation();setMissionGateDiaryId("")}};
  document.addEventListener("keydown",onKey,true);
  return()=>{window.clearTimeout(timer);document.removeEventListener("keydown",onKey,true)};
 },[missionGateDiaryId]);
 const notify=(t:string)=>setMessage(t);
 const current=classes.find(x=>x.id===session);
 const currentOpening=current?data.openings[current.id]:undefined;
 const bypassActive=!!current&&!currentOpening;
 const skipConfirmed=bypassActive&&confirmedSkipClassId===current.id;
 const canWriteExistingDiary=diaryHostAdmitted&&skipConfirmed&&!readOnly;
 const proofClass=classes.find(c=>c.id===proofClassId);
 const proofOpening=proofClassId?data.openings[proofClassId]:undefined;
 const people=current?(data.participants[current.id]||[]).map(id=>data.students.find(s=>s.id===id)).filter((x):x is Student=>!!x):[];
 const currentDiaries=useMemo(()=>data.diaries.filter(d=>d.teachingContextKey===session).sort((a,b)=>b.at.localeCompare(a.at)),[data.diaries,session]);
 const student=data.students.find(s=>s.id===studentId);
 const learningHistory=(id:string)=>data.diaries.filter(d=>d.studentId===id).sort((a,b)=>b.at.localeCompare(a.at));
 const studentHistory=student?learningHistory(student.id):[];
 const missionJourney=(id:string,missionId:string)=>learningHistory(id).flatMap(d=>d.missions.filter(entry=>entry.id===missionId).map(entry=>({diary:d,mission:entry})));
 const unfinishedFor=(id:string)=>{const seen=new Set<string>();return learningHistory(id).flatMap(d=>d.missions.map(entry=>({diary:d,mission:entry}))).filter(({diary,mission:entry})=>{if(seen.has(entry.id))return false;seen.add(entry.id);return entry.completed!==true})};
 const assignedFor=(id:string)=>currentDiaries.filter(d=>d.studentId===id);
 const canAppendToDiary=(_d:Diary)=>false; // No admitted append command; displayed prerequisites are hints only.
 const selected=mission(chosenMission);
 const prerequisite=(m:Mission,id:string)=>m.prerequisites.map(code=>({code,ok:learningHistory(id).some(d=>(d.status==="CLOSED"||!!d.draftSavedAt)&&d.missions.some(x=>x.id===code&&x.completed===true))}));
 const missingCodes=(m:Mission,id:string)=>prerequisite(m,id).filter(r=>!r.ok).map(r=>r.code);
 const availableMission=(id:string,excludeId?:string,excludeMissionId?:string)=>catalog.filter(m=>{
  if(!current?.pathProgramId||m.path!==current.pathProgramId)return false;
  const owner=currentDiaries.find(d=>d.studentId===id&&d.path===m.path);
  if(owner?.status==="CLOSED")return false;
  if(owner&&!(excludeId===owner.id&&!!excludeMissionId)&&(!owner.draftSavedAt||owner.missions.some(entry=>entry.completed!==true)))return false;
  if(currentDiaries.some(d=>d.studentId===id&&d.missions.some(entry=>entry.id===m.id&&!(d.id===excludeId&&entry.id===excludeMissionId))))return false;
  return missingCodes(m,id).length===0;
 });
 const isDiaryDirty=overlay==="diary"&&data.diaries.find(d=>d.id===selectedDiary)?.status==="REGISTERED"&&diaryFormSignature(missionResults,interest,notes,difficulty,evidence)!==diaryInitialSnapshot;
 const inScope=(m:Mission)=>(!replacingDiaryId||data.diaries.find(d=>d.id===replacingDiaryId)?.path===m.path)&&(!appendDiaryId||data.diaries.find(d=>d.id===appendDiaryId)?.path===m.path);
 const eligible=availableMission(studentId,replacingDiaryId||undefined,replacingMissionId||undefined).filter(inScope);
 const closeOverlay=()=>{if(diaryWriteLock.current)return;if(discardConfirm){setDiscardConfirm(false);return}if(overlay==="historyDetail"){setOverlay("student");return}if(overlay==="diary"&&isDiaryDirty){setDiscardConfirm(true);return}setOverlay("");setDiscardConfirm(false);setReplacingDiaryId("");setReplacingMissionId("");setAppendDiaryId("");setAppendOpen(false);setDraftPhotos([]);setDraftNote("")};
 const discardDiaryEdits=()=>{setDiscardConfirm(false);setOverlay("");setFormErrors([]);setDiaryInitialSnapshot("")};
 useEffect(()=>{if(!overlay)return;const focused=document.activeElement instanceof HTMLElement?document.activeElement:null;requestAnimationFrame(()=>sheetRef.current?.querySelector<HTMLButtonElement>("header button")?.focus());return()=>{if(focused?.isConnected)focused.focus()}},[overlay]);
 useEffect(()=>{if(discardConfirm)requestAnimationFrame(()=>document.querySelector<HTMLButtonElement>('[aria-label="Bỏ thay đổi Nhật ký?"] button')?.focus())},[discardConfirm]);
 useEffect(()=>{if(!overlay)return;const onKey=(e:KeyboardEvent)=>{if(e.key==="Escape"){e.preventDefault();e.stopPropagation();closeOverlay();return}if(e.key!=="Tab")return;const root=discardConfirm?document.querySelector('[aria-label="Bỏ thay đổi Nhật ký?"]'):sheetRef.current;if(!root)return;const controls=Array.from(root.querySelectorAll<HTMLElement>('button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),a[href],[tabindex]:not([tabindex="-1"])')).filter(el=>el.getBoundingClientRect().width>0&&getComputedStyle(el).visibility!=="hidden");if(!controls.length)return;const first=controls[0],last=controls[controls.length-1];if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus()}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus()}};document.addEventListener("keydown",onKey,true);return()=>document.removeEventListener("keydown",onKey,true)},[overlay,discardConfirm,isDiaryDirty]);
 const toLauncher=()=>{setMissionCreateRequest(null);setSession("");setOpening("");setConfirmedSkipClassId("");setOverlay("");setAppendOpen(false);setBypassConfirm(false);setTab("students")};
 const showProof=(id:string,append=false)=>{if(!data.openings[id])return;setProofClassId(id);setDraftPhotos([]);setDraftNote("");setAppendOpen(append);setOverlay("photo")};
 const askOpen=(s:ScheduledClass)=>{if(openingWriteLock.current)return;setSession("");setConfirmedSkipClassId("");setOpening(s.id);setOpeningImage("");setBypassConfirm(false);
  void readClassOpening(classScope(s)).then(snapshot=>setOpeningSnapshots(prev=>({...prev,[s.id]:snapshot}))).catch(()=>setOpeningSnapshots(prev=>({...prev,[s.id]:undefined})));
 };
 const enter=(s:ScheduledClass)=>{if(data.openings[s.id]){setConfirmedSkipClassId("");setSession(s.id);setTab("students");setOverlay("")}else askOpen(s)};
 const confirmBypass=()=>{if(!opening||!classes.some(c=>c.id===opening))return;
  setConfirmedSkipClassId(opening);setSession(opening);setOpening("");setBypassConfirm(false);setOverlay("");setTab("students")};
 const handlePhoto=(files:FileList|null)=>{const f=files?.[0];if(!f)return;if(!f.type.startsWith("image/")){notify("Cần chọn ảnh chụp setup lớp.");return}setOpeningBusy(true);const img=new Image();const src=URL.createObjectURL(f);img.onload=()=>{try{const ratio=Math.min(1,960/Math.max(img.naturalWidth,img.naturalHeight));const cv=document.createElement("canvas");cv.width=Math.max(1,Math.round(img.naturalWidth*ratio));cv.height=Math.max(1,Math.round(img.naturalHeight*ratio));const ctx=cv.getContext("2d");if(!ctx)throw Error("canvas");ctx.drawImage(img,0,0,cv.width,cv.height);setOpeningImage(cv.toDataURL("image/jpeg",0.67))}catch{notify("Không xử lý được ảnh setup.")}finally{URL.revokeObjectURL(src);setOpeningBusy(false)}};img.onerror=()=>{URL.revokeObjectURL(src);setOpeningBusy(false);notify("Không đọc được ảnh setup.")};img.src=src};
 const confirmOpen=async()=>{
  const c=classes.find(item=>item.id===opening);
  if(openingWriteLock.current||openingBusy||!c)return;
  if(openingSnapshots[c.id]?.opening){
   setConfirmedSkipClassId("");setSession(c.id);setOpening("");setOpeningImage("");setBypassConfirm(false);setOverlay("");setTab("students");return;
  }
  if(readOnly||!openingImage||!openingSnapshots[c.id]?.canConfirm)return;
  openingWriteLock.current=true;setOpeningBusy(true);
  try{
   const snapshot=await confirmClassOpening(classScope(c),openingImage);
   if(!snapshot.opening)throw new Error("Core chưa xác nhận mở lớp.");
   setOpeningSnapshots(prev=>({...prev,[c.id]:snapshot}));
   setConfirmedSkipClassId("");setSession(c.id);setOpening("");setOpeningImage("");setBypassConfirm(false);setOverlay("");setTab("students");
  }catch(error){notify(error instanceof Error?error.message:"Chưa thể mở lớp.");}
  finally{openingWriteLock.current=false;setOpeningBusy(false);}
 };
 const openStudent=(id:string)=>{setStudentId(id);setOverlay("student")};
 const openHistory=(d:Diary)=>{setStudentId(d.studentId);setSelectedDiary(d.id);setSelectedMissionId(d.missions[0]?.id||"");setOverlay("historyDetail")};
 const showAdd=()=>{setPageLimit(50);setAddError(false);setAddMode("existing");setLookup("");setNewName("");setNewAge("");setNewGender("Nữ");setOverlay("add")};
 const [candidatePage,setCandidatePage]=useState<{key:string;items:RosterCandidate[];more:boolean;error:boolean}|null>(null);
 const [pageLimit,setPageLimit]=useState(50);
 const [adding,setAdding]=useState(false);
 const addLock=useRef(false);
 const [addError,setAddError]=useState(false);
 const searchKey=JSON.stringify([current?.id,lookup,pageLimit]);
 useEffect(()=>{
  if(overlay!=="add"||addMode!=="existing"||!current||readOnly)return;
  const controller=new AbortController();
  const timer=setTimeout(()=>{
   void searchClassroomStudents(model.centerId,current.runningClassId,lookup,pageLimit,controller.signal)
    .then(result=>{if(!controller.signal.aborted)setCandidatePage({key:searchKey,...result,error:false});})
    .catch(()=>{if(!controller.signal.aborted)setCandidatePage({key:searchKey,items:[],more:false,error:true});});
  },180);
  return()=>{clearTimeout(timer);controller.abort();};
 },[overlay,addMode,current,readOnly,model.centerId,lookup,pageLimit,searchKey]);
 const displayedCandidates=candidatePage?.key===searchKey?candidatePage:null;
 const addExisting=async(id:string)=>{
  if(readOnly||!current||!onRosterChanged||addLock.current||people.some(p=>p.id===id))return;
  addLock.current=true;setAdding(true);setAddError(false);
  try{
   await addClassroomStudent(model.centerId,current.runningClassId,model.today,id);
   await onRosterChanged(current.id,id);
   setOverlay("");
  }catch{setAddError(true);}
  finally{addLock.current=false;setAdding(false);}
 };
 const addLead=blocked;
 const assign=(id?:string)=>{const sid=id||studentId;if(id)setStudentId(id);setReplacingDiaryId("");setReplacingMissionId("");setAppendDiaryId("");setMissionSearch("");const first=availableMission(sid).find(m=>m.path===current?.path&&m.subject===current?.subject)||availableMission(sid)[0];setChosenMission(first?.id||"");setOverlay("assign")};
 const addMissionToDiary=(d:Diary)=>{
  if(!canAppendToDiary(d)){setMissionGateDiaryId(d.id);return}
  setStudentId(d.studentId);setAppendDiaryId(d.id);setReplacingDiaryId("");setReplacingMissionId("");setMissionSearch("");setChosenMission(availableMission(d.studentId).find(m=>m.path===d.path)?.id||"");setOverlay("assign")
 };
 const changeMission=(d:Diary,oldId:string)=>{if(d.status!=="REGISTERED"){notify("Chỉ đổi Mission trước khi kết thúc Diary.");return}const old=d.missions.find(m=>m.id===oldId);if(!old){notify("Không tìm thấy Mission trong Diary.");return}if(old.completed!==null){notify("Mission đã có kết quả lưu nháp; không được đổi để tránh mất lịch sử.");return}setStudentId(d.studentId);setAppendDiaryId("");setReplacingDiaryId(d.id);setReplacingMissionId(oldId);setMissionSearch("");const inPath=availableMission(d.studentId,d.id,oldId).find(m=>m.path===d.path);setChosenMission(inPath?.id||"");setOverlay("assign")};
 const options=catalog.filter(m=>!!current?.pathProgramId&&m.path===current.pathProgramId&&inScope(m)&&((m.id+" "+m.name+" "+m.path).toLocaleLowerCase("vi").includes(missionSearch.toLocaleLowerCase("vi")))).sort((a,b)=>Number(eligible.some(m=>m.id===b.id))-Number(eligible.some(m=>m.id===a.id)));
 const register=blocked;
 const openGuide=(d:Diary,missionId:string)=>{setSelectedDiary(d.id);setSelectedMissionId(missionId);setOverlay("guide")};
 const openDiary=(d:Diary)=>{
  const initialEvidence=d.media??(d.mediaNames||[]).map(name=>({name,kind:"video" as const}));
  const initialInterest=d.interest!==null&&d.interest>=1&&d.interest<=4?d.interest:null;
  const results=Object.fromEntries(d.missions.map(m=>[m.id,m.completed])) as Record<string,boolean|null>;
  setSelectedDiary(d.id);setStudentId(d.studentId);setMissionResults(results);setInterest(initialInterest);setDifficulty(d.difficulty||"");setFormErrors([]);setNotes(d.notes);setEvidence(initialEvidence);
  setDiaryInitialSnapshot(diaryFormSignature(results,initialInterest,d.notes,d.difficulty||"",initialEvidence));setDiscardConfirm(false);setOverlay("diary");
 };
 const writeExistingDiary=async(kind:"draft"|"close")=>{
  const d=data.diaries.find(x=>x.id===selectedDiary);
  if(!d||d.status!=="REGISTERED"||d.teachingContextKey!==current?.id||!canWriteExistingDiary||diaryWriteLock.current)return;
  const errors=kind==="close"?validateClassroomDraft({missionIds:d.missions.map(m=>m.id),results:missionResults,interest,notes,difficulty,hasImage:evidence.some(e=>e.kind==="image"&&!!e.preview),uploading}):[];
  setFormErrors(errors);if(errors.length)return;
  diaryWriteLock.current=true;setDiaryWriting(true);
  try{
   const saved=await saveExistingClassroomDiary({centerId:model.centerId,runningClassId:current.runningClassId,
    diary:d,kind,notes,interest,difficulty,evidence});
   setDiaryEdits(previous=>({...previous,[d.id]:saved}));
   setDiaryInitialSnapshot(diaryFormSignature(missionResults,interest,notes,difficulty,evidence));
  }catch{setFormErrors(["Core chưa xác nhận thao tác. Vui lòng kiểm tra và thử lại."]);}
  finally{diaryWriteLock.current=false;setDiaryWriting(false);}
 };
 const addEvidence=async(files:FileList|null)=>{if(!files)return;const list=Array.from(files).slice(0,20);if(files.length>20)notify("Biểu mẫu xử lý tối đa 20 tệp mỗi lần.");setUploading(true);const next:Evidence[]=[];for(const file of list){if(!file.type.startsWith("image/")&&!file.type.startsWith("video/")){notify("Chỉ nhận ảnh hoặc video.");continue}if(file.type.startsWith("video/")){next.push({name:file.name,kind:"video"});continue}if(file.size>5_000_000){notify("Ảnh cần dưới 5 MB.");continue}try{const media=await new Promise<Evidence>((resolve,reject)=>{const img=new Image();const url=URL.createObjectURL(file);img.onload=()=>{try{const scale=Math.min(1,840/Math.max(img.naturalWidth,img.naturalHeight));const canvas=document.createElement("canvas");canvas.width=Math.max(1,Math.round(img.naturalWidth*scale));canvas.height=Math.max(1,Math.round(img.naturalHeight*scale));const context=canvas.getContext("2d");if(!context)throw Error("canvas");context.drawImage(img,0,0,canvas.width,canvas.height);resolve({name:file.name,kind:"image",preview:canvas.toDataURL("image/jpeg",0.62)})}catch(err){reject(err)}finally{URL.revokeObjectURL(url)}};img.onerror=()=>{URL.revokeObjectURL(url);reject(Error("image"))};img.src=url});next.push(media)}catch{notify("Không xử lý được ảnh: "+file.name)}}if(next.length){setEvidence(prev=>[...prev,...next]);setFormErrors(v=>v.filter(x=>!x.includes("ảnh bằng chứng")))}setUploading(false);};
 const handleSupplementPhotos=async(files:FileList|null)=>{
  if(!files?.length)return;
  const selection=Array.from(files).slice(0,10);
  if(files.length>10)notify("Biểu mẫu xử lý tối đa 10 ảnh mỗi lần.");
  setAppendBusy(true);
  const next:OpeningPhoto[]=[];
  for(const file of selection){
   if(!file.type.startsWith("image/")){notify("Chỉ chọn ảnh setup.");continue}
   if(file.size>8_000_000){notify(file.name+" vượt 8MB.");continue}
   try{
    const photo=await new Promise<OpeningPhoto>((resolve,reject)=>{
     const img=new Image();const url=URL.createObjectURL(file);
     img.onload=()=>{
      try{const factor=Math.min(1,880/Math.max(img.naturalWidth,img.naturalHeight));
       const c=document.createElement("canvas");c.width=Math.max(1,Math.round(img.naturalWidth*factor));c.height=Math.max(1,Math.round(img.naturalHeight*factor));
       const ctx=c.getContext("2d");if(!ctx)throw Error("canvas");ctx.drawImage(img,0,0,c.width,c.height);
       const now=new Date().toISOString();
       resolve({id:"setup-"+now+"-"+Math.random().toString(36).slice(2,8),fileName:file.name,preview:c.toDataURL("image/jpeg",.62),uploadedAt:now,uploadedBy:staff});
      }catch(err){reject(err)}finally{URL.revokeObjectURL(url)}
     };
     img.onerror=()=>{URL.revokeObjectURL(url);reject(Error("image"))};img.src=url;
    });
    next.push(photo);
   }catch{notify("Không đọc được ảnh: "+file.name)}
  }
  if(next.length)setDraftPhotos(prev=>[...prev,...next]);
  setAppendBusy(false);
 };
 const submitSupplement=async()=>{
  if(readOnly||appendBusy||appendWriteLock.current||!proofClass||!proofOpening?.canAppend||draftPhotos.length!==1||draftNote.trim())return;
  const image=draftPhotos[0]?.preview;
  if(!image)return;
  const signature=JSON.stringify([proofOpening.receiptId,proofOpening.version,image]);
  const key=appendRetry.current?.signature===signature?appendRetry.current.key:newOpeningRequestKey();
  appendRetry.current={signature,key};appendWriteLock.current=true;setAppendBusy(true);
  try{
   const snapshot=await appendClassOpening(classScope(proofClass),proofOpening,image,key);
   setOpeningSnapshots(prev=>({...prev,[proofClass.id]:snapshot}));
   appendRetry.current=null;setDraftPhotos([]);setDraftNote("");setAppendOpen(false);
  }catch(error){notify(error instanceof Error?error.message:"Chưa thể gửi ảnh setup.");}
  finally{appendWriteLock.current=false;setAppendBusy(false);}
 };
 const genderLabel=(s:Pick<Student,"gender">)=>s.gender==="Nữ"?"♀":s.gender==="Nam"?"♂":"·";
 const genderBadge=(s:Pick<Student,"gender">)=>s.gender==="Khác / chưa cung cấp"?null:<span aria-label={"Giới tính: "+s.gender} title={s.gender} className={s.gender==="Nữ"?styles.genderFemale:s.gender==="Nam"?styles.genderMale:styles.genderUnknown} data-tos-slot={tosSlotKeys(s.gender==="Nữ"?styles.genderFemale:s.gender==="Nam"?styles.genderMale:styles.genderUnknown)}>{genderLabel(s)}</span>;
 const avatar=(s:Student)=><span className={s.domain==="art"?styles.avatarArt:styles.avatarPiano} data-tos-slot={tosSlotKeys(s.domain==="art"?styles.avatarArt:styles.avatarPiano)} aria-label={s.name}>{s.name.split(" ").slice(-2).map(v=>v[0]).join("").toUpperCase()}</span>;
 const badge=(d:Diary)=><span className={d.status==="CLOSED"?styles.badgeGood:d.draftSavedAt?styles.badgePending:styles.badgePending} data-tos-slot={tosSlotKeys(d.status==="CLOSED"?styles.badgeGood:d.draftSavedAt?styles.badgePending:styles.badgePending)}>{d.status==="CLOSED"?"Đã kết thúc":d.draftSavedAt&&d.missions.every(m=>m.completed!==null)?"Đã lưu nháp":"Đang học"}</span>;
 const missionBadge=(d:Diary,m:DiaryMission)=><span className={m.completed===true&&!!(d.draftSavedAt||d.closedAt)?styles.badgeGood:m.completed===false&&!!(d.draftSavedAt||d.closedAt)?styles.badgeBad:styles.badgePending} data-tos-slot={tosSlotKeys(m.completed===true&&!!(d.draftSavedAt||d.closedAt)?styles.badgeGood:m.completed===false&&!!(d.draftSavedAt||d.closedAt)?styles.badgeBad:styles.badgePending)}>{m.completed===true?"Đã hoàn thành":m.completed===false?"Chưa hoàn thành":"Đang học"}</span>;
 const previousClosedDiary=(id:string)=>learningHistory(id).filter(d=>d.status==="CLOSED"&&d.teachingContextKey!==session).sort((a,b)=>(b.closedAt||b.at).localeCompare(a.closedAt||a.at))[0];
 const person=(s:Student)=>{
  const previous=previousClosedDiary(s.id);
  return <article className={styles.personCard} data-tos-slot={tosSlotKeys(styles.personCard)} key={s.id}>{avatar(s)}<div className={styles.personBody} data-tos-slot={tosSlotKeys(styles.personBody)}><div className={styles.personTitle} data-tos-slot={tosSlotKeys(styles.personTitle)}><strong>{s.name}</strong>{typeof s.age==="number"&&s.age>0&&<span className={styles.studentAge}>{s.age} tuổi</span>}{genderBadge(s)}{s.lead&&<em>Lead</em>}</div><p>{s.domain==="art"?"Mỹ thuật":s.domain==="piano"?"Piano":"Chưa có chuyên môn"} · Path {s.path}</p>
   {previous?<div className={styles.previousLessonSummary} data-tos-slot={tosSlotKeys(styles.previousLessonSummary)} aria-label={"Buổi học trước của "+s.name} data-previous-lesson={s.id}>
     <div className={styles.previousLessonTop} data-tos-slot={tosSlotKeys(styles.previousLessonTop)}><span className={styles.previousLessonTask} data-tos-slot={tosSlotKeys(styles.previousLessonTask)}><strong>Nhiệm vụ trước:</strong> {previous.missions.at(-1)?.name||"Chưa có nhiệm vụ"}</span><strong className={styles.previousLessonRating} data-tos-slot={tosSlotKeys(styles.previousLessonRating)} aria-label={"Độ hứng thú "+(previous.interest!==null&&previous.interest>=1&&previous.interest<=4?previous.interest:"chưa có")+" trên 4"}>{previous.interest!==null&&previous.interest>=1&&previous.interest<=4?previous.interest:"—"}/4</strong></div>
     <p className={styles.previousLessonNote} data-tos-slot={tosSlotKeys(styles.previousLessonNote)}><strong>{previous.closedBy||previous.registeredBy||"Giáo viên"}:</strong> {previous.notes.trim()||"Chưa có nhận xét."}</p>
    </div>:<div className={styles.previousLessonEmpty} data-tos-slot={tosSlotKeys(styles.previousLessonEmpty)} data-previous-lesson={s.id}>{model.diaryReadState==="LOADED"?"Chưa có Nhật ký của buổi học trước.":"Chưa tải được Nhật ký của buổi học trước."}</div>}
   <div className={styles.personActions} data-tos-slot={tosSlotKeys(styles.personActions)}><button onClick={()=>openStudent(s.id)}>Hồ sơ & lịch sử</button><button type="button" disabled={readOnly}
     className={styles.missionAddAction} aria-label={"Thêm nhiệm vụ cho "+s.name}
     onClick={()=>{missionCreateSequence.current+=1;setMissionCreateRequest({id:missionCreateSequence.current,studentId:s.id})}}>+ Nhiệm vụ</button></div></div></article>;
 };
 const diaryListState=(current&&model.diaryOccurrenceReadState?.[current.id])??model.diaryReadState;
 const rows=diaryStateFilter==="all"?currentDiaries:currentDiaries.filter(d=>d.status===diaryStateFilter);
 return <main className={styles.shell} data-tos-slot={tosSlotKeys(styles.shell)}><div className={styles.phone} data-tos-slot={tosSlotKeys(styles.phone)}>
  {!session&&!opening&&<div className={styles.content} data-tos-slot={tosSlotKeys(styles.content)}>{classes.map(c=>{const o=data.openings[c.id];const last=lastRound(o);const rejected=needsAction(o);const hasEarlierReject=!!o&&evidenceRounds(o).some(r=>r.status==="REJECTED");return <article className={styles.classCard} data-tos-slot={tosSlotKeys(styles.classCard)} key={c.id}><div className={styles.classTop} data-tos-slot={tosSlotKeys(styles.classTop)}><div className={styles.classIcon} data-tos-slot={tosSlotKeys(styles.classIcon)}><FontAwesomeIcon icon={icon(c.subject)}/></div><div className={styles.classSummary} data-tos-slot={tosSlotKeys(styles.classSummary)}><strong>{c.name}</strong><span><FontAwesomeIcon icon={faClock}/> {c.time} {c.room&&"· "+c.room}</span><span><FontAwesomeIcon icon={faUsers}/> Dạy chung: {c.staff.join(" · ")||"Chưa có thông tin"}</span></div></div><div className={styles.classFooter} data-tos-slot={tosSlotKeys(styles.classFooter)}><div><span className={o?styles.badgeGood:styles.badgePending} data-tos-slot={tosSlotKeys(o?styles.badgeGood:styles.badgePending)}>{o?"Đã mở lớp":openingSnapshots[c.id]?"Chưa mở lớp":"Chưa xác minh mở lớp"}</span><small>{c.expected.length} học viên dự kiến</small>{o&&<small>Mở bởi {o.openedBy}</small>}{o&&<span className={reviewState(o)==="REJECTED"?styles.badgeBad:reviewState(o)==="APPROVED"?styles.badgeGood:styles.badgePending} data-tos-slot={tosSlotKeys(reviewState(o)==="REJECTED"?styles.badgeBad:reviewState(o)==="APPROVED"?styles.badgeGood:styles.badgePending)}>{hasEarlierReject&&last?.status==="PENDING"?"Đã bổ sung · chờ duyệt lại":"Ảnh: "+reviewText(reviewState(o))}</span>}</div><button className={styles.primaryButton} data-tos-slot={tosSlotKeys(styles.primaryButton)} onClick={()=>enter(c)}>{o?"Vào lớp":"Mở lớp"} <FontAwesomeIcon icon={faChevronRight}/></button></div>{rejected&&<div className={styles.classRejected} data-tos-slot={tosSlotKeys(styles.classRejected)} role="status" aria-label={"Cần bổ sung ảnh setup - "+c.name}><div><strong><FontAwesomeIcon icon={faTriangleExclamation}/> Ảnh setup chưa được duyệt</strong><p>{last?.reason||"Cần bổ sung ảnh setup theo yêu cầu BO."}</p></div><button disabled={readOnly||!o?.canAppend} onClick={()=>showProof(c.id,true)}>Bổ sung ảnh <FontAwesomeIcon icon={faChevronRight}/></button></div>}</article>})}</div>}
  {opening&&<div className={styles.content} data-tos-slot={tosSlotKeys(styles.content)}><section className={styles.prep} data-tos-slot={tosSlotKeys(styles.prep)}><span>BƯỚC MỞ LỚP</span><h2>Kiểm tra setup phòng học</h2><p>{classes.find(c=>c.id===opening)?.name} · {classes.find(c=>c.id===opening)?.room}</p></section><div className={styles.openPanel} data-tos-slot={tosSlotKeys(styles.openPanel)}><div className={styles.step} data-tos-slot={tosSlotKeys(styles.step)}><span>1</span><div><strong>Chụp ảnh phòng đã setup</strong><p>Ghi lại hiện trạng trước giờ dạy. Chỉ người mở lớp đầu tiên thực hiện.</p></div></div><label className={styles.photoPicker} data-tos-slot={tosSlotKeys(styles.photoPicker)}><FontAwesomeIcon icon={faCamera}/> {openingImage?"Thay ảnh setup":"Chụp / chọn ảnh setup"}<input aria-label="Ảnh setup lớp" type="file" accept="image/*" capture="environment" onChange={e=>handlePhoto(e.target.files)}/></label>{openingImage?<img className={styles.openPreview} data-tos-slot={tosSlotKeys(styles.openPreview)} src={openingImage} alt="Ảnh setup lớp vừa chụp"/>:<div className={styles.photoPlaceholder} data-tos-slot={tosSlotKeys(styles.photoPlaceholder)}><FontAwesomeIcon icon={faCamera}/> Chưa có ảnh setup</div>}<div className={styles.step} data-tos-slot={tosSlotKeys(styles.step)}><span>2</span><div><strong>Xác nhận mở lớp</strong><p>Mở lớp cần được hệ thống xác nhận. Các thao tác ghi vẫn khóa đến khi đủ điều kiện.</p></div></div><button disabled={openingBusy||(!openingSnapshots[opening]?.opening&&(readOnly||!openingImage||!openingSnapshots[opening]?.canConfirm))} className={styles.primaryButtonWide} data-tos-slot={tosSlotKeys(styles.primaryButtonWide)} onClick={()=>void confirmOpen()}>{openingSnapshots[opening]?.opening?"Vào lớp":"Xác nhận mở lớp"} <FontAwesomeIcon icon={faCheck}/></button><div className={styles.bypassEntry} data-tos-slot={tosSlotKeys(styles.bypassEntry)}><button type="button" className={styles.bypassEntryButton} data-tos-slot={tosSlotKeys(styles.bypassEntryButton)} disabled={openingBusy} onClick={()=>setBypassConfirm(true)}>Vào lớp không mở ca</button>{bypassConfirm&&<div className={styles.bypassConfirm} data-tos-slot={tosSlotKeys(styles.bypassConfirm)} role="dialog" aria-label="Xác nhận vào lớp không mở ca"><strong>Bạn có chắc không mở ca vẫn vào lớp?</strong><p>Thông tin này sẽ được gửi đến Quản lý</p><div><button type="button" onClick={()=>setBypassConfirm(false)}>Hủy</button><button type="button" onClick={confirmBypass}>Vào lớp không mở ca</button></div></div>}</div><button className={styles.cancel} data-tos-slot={tosSlotKeys(styles.cancel)} disabled={openingBusy} onClick={()=>{setOpening("");setOpeningImage("")}}>Quay lại danh sách lớp</button></div></div>}
  {session&&current&&(currentOpening||bypassActive)&&<><header className={styles.sessionBar} data-tos-slot={tosSlotKeys(styles.sessionBar)} data-tos-vnext="classroom-detail-header" aria-label={"Lớp đang truy cập: "+current.name}><button type="button" className={styles.sessionBack} data-tos-slot={tosSlotKeys(styles.sessionBack)} onClick={toLauncher} aria-label="Trở về danh sách lớp"><FontAwesomeIcon icon={faArrowLeft}/></button><div className={styles.sessionIcon} data-tos-slot={tosSlotKeys(styles.sessionIcon)}><FontAwesomeIcon icon={icon(current.subject)}/></div><div className={styles.sessionInfo} data-tos-slot={tosSlotKeys(styles.sessionInfo)}><h1 className={styles.sessionTitle} data-tos-slot={tosSlotKeys(styles.sessionTitle)}>{current.name}</h1><span>{current.time} {current.room&&"· "+current.room}</span></div><button type="button" className={styles.sessionPhoto} data-tos-slot={tosSlotKeys(styles.sessionPhoto)} disabled={!currentOpening} onClick={()=>showProof(current.id)} aria-label={currentOpening?"Xem ảnh setup":"Chưa xác minh ảnh setup"}><FontAwesomeIcon icon={faCamera}/></button></header><div ref={classContentRef} className={styles.content} data-tos-slot={tosSlotKeys(styles.content)}><p className={styles.sessionTeaching} data-tos-slot={tosSlotKeys(styles.sessionTeaching)}><FontAwesomeIcon icon={faUsers}/> Dạy chung: {current.staff.join(" · ")||"Chưa có thông tin"}<span>{currentOpening?"Mở bởi "+currentOpening.openedBy:skipConfirmed?"Chưa mở lớp":"Chỉ xem"}</span></p>
    {tab==="students"&&<section role="tabpanel" id="tos-classroom-panel-students" aria-labelledby="tos-classroom-tab-students"><div className={styles.sectionHead} data-tos-slot={tosSlotKeys(styles.sectionHead)}><div><h2>Học viên trong buổi ({people.length})</h2></div><button disabled={readOnly} onClick={showAdd}>Thêm</button></div>{people.map(person)}{people.some(s=>model.conflictStudentIds.includes(s.id))&&<p role="alert">Danh sách có học viên xung đột. Cần kiểm tra trước khi ghi.</p>}</section>}
    {(tab==="students"||tab==="missions")&&<MissionAssignmentTab
      key={JSON.stringify([model.centerId,model.today,current.runningClassId,current.id])}
      scope={{centerId:model.centerId,localDate:model.today,runningClassId:current.runningClassId,teachingContextKey:current.id,pathProgramId:current.pathProgramId,pathLabel:current.path}}
      readOnly={readOnly} visible={tab==="missions"} createRequest={missionCreateRequest}
      onCreateRequestConsumed={id=>setMissionCreateRequest(prev=>prev?.id===id?null:prev)}/>}
    {tab==="diaries"&&<section role="tabpanel" id="tos-classroom-panel-diaries" aria-labelledby="tos-classroom-tab-diaries">
      <div className={styles.sectionHead} data-tos-slot={tosSlotKeys(styles.sectionHead)}><div><h2>Nhật ký buổi học ({diaryListState==="LOADED"?currentDiaries.length:"—"})</h2><p>Mỗi học viên × Path có đúng một Diary; tất cả Mission của Path nằm chung bên trong.</p></div></div>

      <div className={styles.filterPills} data-tos-slot={tosSlotKeys(styles.filterPills)}>{([["all","Tất cả"],["REGISTERED","Đang học"],["CLOSED","Đã kết thúc"]] as const).map(([key,label])=><button key={key} className={diaryStateFilter===key?styles.selectedPill:""} data-tos-slot={tosSlotKeys(diaryStateFilter===key?styles.selectedPill:"")} aria-pressed={diaryStateFilter===key} onClick={()=>setDiaryStateFilter(key)}>{label}</button>)}</div>
      {rows.length===0?<p className={styles.empty} data-tos-slot={tosSlotKeys(styles.empty)}>{diaryListState==="LOADED"?"Không có Nhật ký phù hợp.":"Chưa tải được Nhật ký. Vui lòng thử lại sau."}</p>:rows.map(d=>{const s=data.students.find(p=>p.id===d.studentId);return <button className={styles.diaryCard} data-tos-slot={tosSlotKeys(styles.diaryCard)} key={d.id} data-diary-id={d.id} data-diary-path={d.path} onClick={()=>openDiary(d)}><div className={styles.rowTop} data-tos-slot={tosSlotKeys(styles.rowTop)}><strong>{s?<>{s.name}{typeof s.age==="number"&&s.age>0&&<span className={styles.studentAge}> · {s.age} tuổi</span>} {genderBadge(s)}</>:"Học viên"}</strong>{badge(d)}</div><h3>Path {d.path} · {d.missions.length} Mission</h3><div className={styles.diaryMissionChips} data-tos-slot={tosSlotKeys(styles.diaryMissionChips)}>{d.missions.map(m=><span key={m.id}>{m.id} · {m.completed===true?"✓ Đã hoàn thành":m.completed===false?"○ Chưa hoàn thành":"Đang học"}</span>)}</div><p>{d.notes||"Chưa ghi nhận kết quả chung cho Path này."}</p><span>{formatPinoDateTime(d.at)} · {d.status==="REGISTERED"?"Mở Diary · Lưu nháp / Kết thúc":"Xem kết quả chung"} <FontAwesomeIcon icon={faChevronRight}/></span></button>})}
      {!readOnly&&<details><summary>Ghi Nhật ký học viên</summary><DiaryCapturePanel key={model.centerId+":"+current.id} model={model} classroom={current} confirmedSkipClassId={skipConfirmed?current.id:""}/></details>}
    </section>}
   </div><AppNavShell className={styles.bottomNav} data-tos-slot={tosSlotKeys(styles.bottomNav)} label="Điều hướng trong lớp" role="tablist">{([["students","Học viên",faUsers],["missions","Nhiệm vụ",faFlag],["diaries","Nhật ký",faClipboardList]] as [Tab,string,IconDefinition][]).map(([id,title,ico])=><button key={id} type="button" role="tab" id={"tos-classroom-tab-"+id} aria-controls={"tos-classroom-panel-"+id} aria-selected={tab===id} aria-current={tab===id?"page":undefined} onClick={()=>{setMissionCreateRequest(null);setTab(id);if(classContentRef.current)classContentRef.current.scrollTop=0}}><FontAwesomeIcon icon={ico}/><span>{title}</span></button>)}</AppNavShell></>}
  {overlay&&<AppModalRoot className={styles.scrim} data-tos-slot={tosSlotKeys(styles.scrim)} onClose={closeOverlay}><section className={styles.sheet} data-tos-slot={tosSlotKeys(styles.sheet)} role="dialog" aria-modal="true" aria-label="Chi tiết lớp học" ref={sheetRef}><div className={styles.handle} data-tos-slot={tosSlotKeys(styles.handle)}/><header><h2>{overlay==="student"?"Hồ sơ & hành trình":overlay==="historyDetail"?"Chi tiết Diary đã học":overlay==="add"?"Thêm học viên vào lớp":overlay==="assign"?(replacingDiaryId?"Đổi nhiệm vụ":"Thêm Nhiệm Vụ"):overlay==="guide"?"Giáo án":overlay==="diary"?"Nhật ký Mission":"Ảnh setup & lịch sử duyệt"}</h2><button aria-label={overlay==="historyDetail"?"Trở lại hồ sơ":"Đóng"} onClick={closeOverlay}><FontAwesomeIcon icon={overlay==="historyDetail"?faArrowLeft:faXmark}/></button></header>
   {overlay==="student"&&student&&<><div className={styles.studentHead} data-tos-slot={tosSlotKeys(styles.studentHead)}>{avatar(student)}<div><strong>{student.name} {genderBadge(student)}{student.age===null?"":" · "+student.age+" tuổi"}</strong><p>{student.domain==="art"?"Mỹ thuật":student.domain==="piano"?"Piano":"Chưa có chuyên môn"} · Path {student.path} {student.lead?"· Lead/trial":""}</p></div></div><h3>Lịch sử Diary gần nhất</h3><p className={styles.smallMuted} data-tos-slot={tosSlotKeys(styles.smallMuted)}>Đọc xuyên lớp để staff mới hiểu thực lực, trải nghiệm và hướng dẫn trước đây.</p>{studentHistory.length===0?<p className={styles.empty} data-tos-slot={tosSlotKeys(styles.empty)}>{model.diaryReadState==="LOADED"?"Chưa có Diary trước đây.":"Chưa tải được lịch sử Diary."}</p>:studentHistory.map(d=><button className={styles.historyEntry} data-tos-slot={tosSlotKeys(styles.historyEntry)} key={d.id} onClick={()=>openHistory(d)} aria-label={"Xem chi tiết Diary Path "+d.path+" "+dateLabel(d.at)}><div className={styles.historyEntryTop} data-tos-slot={tosSlotKeys(styles.historyEntryTop)}><span>{dateLabel(d.at)} · {d.registeredBy}</span>{badge(d)}</div><strong>Path {d.path} · {d.missions.length} Mission</strong><p>{d.missions.map(m=>m.id+" · "+m.name).join("  ·  ")}</p><p>{d.notes||"Chưa có nhận xét."}</p><span className={styles.historyEntryFooter} data-tos-slot={tosSlotKeys(styles.historyEntryFooter)}>Hứng thú: {interestText(d.interest,d.closedAt)} <span>Xem chi tiết <FontAwesomeIcon icon={faChevronRight}/></span></span></button>)}</>}

   {overlay==="historyDetail"&&(()=>{const d=data.diaries.find(x=>x.id===selectedDiary);const s=d&&data.students.find(x=>x.id===d.studentId);if(!d||!s)return <p>Không tìm thấy Diary.</p>;return <div className={styles.historyDetail} data-tos-slot={tosSlotKeys(styles.historyDetail)} data-history-detail-id={d.id}>
    <div className={styles.studentHead} data-tos-slot={tosSlotKeys(styles.studentHead)}>{avatar(s)}<div><strong>{s.name} {genderBadge(s)}</strong><p>{s.age===null?"Chưa có tuổi":s.age+" tuổi"} · Path {d.path} · {dateLabel(d.at)}</p></div></div>
    <section className={styles.historyFact} data-tos-slot={tosSlotKeys(styles.historyFact)}><div className={styles.historyEntryTop} data-tos-slot={tosSlotKeys(styles.historyEntryTop)}><strong>Nhật ký Path {d.path}</strong>{badge(d)}</div><dl>
     <div><dt>Đăng ký</dt><dd>{dateLabel(d.at)} · {timeLabel(d.at)} · {d.registeredBy}</dd></div>
     <div><dt>Kết thúc</dt><dd>{d.closedAt?dateLabel(d.closedAt)+" · "+timeLabel(d.closedAt)+" · "+(d.closedBy||"—"):"Chưa ghi nhận"}</dd></div>
     <div><dt>Số nhiệm vụ</dt><dd>{d.missions.length} Mission · 1 Diary (không nhân số lượt học)</dd></div>
     <div><dt>Trải nghiệm</dt><dd>{interestText(d.interest,d.closedAt)}</dd></div>
    </dl><h3>Kết quả từng Mission</h3>
     {d.missions.map(entry=><div className={styles.historyMission} data-tos-slot={tosSlotKeys(styles.historyMission)} key={entry.id}><strong>{entry.id} · {entry.name}</strong>{missionBadge(d,entry)}<small>{entry.assignedBy} · {timeLabel(entry.assignedAt)}</small></div>)}
     {d.missionChanges.length>0&&<div className={styles.changeLedger} data-tos-slot={tosSlotKeys(styles.changeLedger)}><h3>Lịch sử đổi nhiệm vụ</h3>{d.missionChanges.map((ch,i)=><p key={i}>{ch.fromId} → {ch.toId} · {ch.changedBy} · {dateLabel(ch.changedAt)}</p>)}</div>}
     <h3>Nhận xét và lưu ý của cả Path</h3><p className={styles.historyNotes} data-tos-slot={tosSlotKeys(styles.historyNotes)}>{d.notes||"Chưa có nhận xét từ giáo viên."}</p>
    </section>
    <section className={styles.historyEvidence} data-tos-slot={tosSlotKeys(styles.historyEvidence)}><h3><FontAwesomeIcon icon={faCamera}/> Ảnh / video bằng chứng chung</h3>{d.media?.some(e=>e.preview)?<div className={styles.evidenceGrid} data-tos-slot={tosSlotKeys(styles.evidenceGrid)}>{d.media.filter(e=>e.preview).map((e,i)=><figure key={i}><img src={e.preview} alt={"Bằng chứng "+e.name}/><figcaption>{e.name}</figcaption></figure>)}</div>:null}{(d.media||[]).filter(e=>!e.preview).map((e,i)=><div className={styles.evidenceFilename} data-tos-slot={tosSlotKeys(styles.evidenceFilename)} key={i}>{e.name} · Chưa có bản xem trước</div>)}{(!d.media||!d.media.length)&&(d.mediaNames||[]).map((name,i)=><div className={styles.evidenceFilename} data-tos-slot={tosSlotKeys(styles.evidenceFilename)} key={i}>{name}</div>)}{!(d.media?.length||d.mediaNames?.length)&&<p className={styles.emptyEvidence} data-tos-slot={tosSlotKeys(styles.emptyEvidence)}>Chưa có ảnh hoặc video.</p>}</section>
    <section className={styles.journeyTimeline} data-tos-slot={tosSlotKeys(styles.journeyTimeline)}><h3>Hành trình Mission xuyên các buổi</h3><p>Nhiều Mission trong một Diary; tiếp tục Mission ở buổi khác sẽ xuất hiện trong Diary của buổi đó.</p>{d.missions.map(entry=><div key={entry.id}><h4>{entry.id} · {entry.name}</h4>{missionJourney(s.id,entry.id).map(({diary:step,mission:result})=><div className={styles.journeyOccurrence} data-tos-slot={tosSlotKeys(styles.journeyOccurrence)} key={step.id}><span>{dateLabel(step.at)} · Path {step.path}</span><strong>{result.completed===true?"Đã hoàn thành"+(step.status==="REGISTERED"?" (nháp)":""):result.completed===false?"Chưa hoàn thành"+(step.status==="REGISTERED"?" (nháp)":""):"Đang học"}</strong>{step.id===d.id&&<small>Đang xem</small>}</div>)}</div>)}</section>
   </div>})()}

   {overlay==="add"&&<><div className={styles.toggle} data-tos-slot={tosSlotKeys(styles.toggle)}><button className={addMode==="existing"?styles.activeToggle:""} data-tos-slot={tosSlotKeys(addMode==="existing"?styles.activeToggle:"")} onClick={()=>setAddMode("existing")}>Toàn bộ học viên</button><button className={addMode==="lead"?styles.activeToggle:""} data-tos-slot={tosSlotKeys(addMode==="lead"?styles.activeToggle:"")} onClick={()=>setAddMode("lead")}>Lead / trial vãng lai</button></div>{addMode==="existing"?<><p className={styles.smallMuted} data-tos-slot={tosSlotKeys(styles.smallMuted)}>Tìm trong toàn bộ học viên, không lọc theo trạng thái hoạt động hay Path. Học viên đã ở lớp vẫn được hiển thị để đối chiếu.</p><label className={styles.search} data-tos-slot={tosSlotKeys(styles.search)}><FontAwesomeIcon icon={faMagnifyingGlass}/><input aria-label="Tìm toàn bộ học viên" value={lookup} onChange={e=>{setLookup(e.target.value);setPageLimit(50);}} placeholder="Tìm tên bất kỳ học viên..."/></label>{!displayedCandidates?<p role="status">Đang tải học viên…</p>:displayedCandidates.error?<p role="alert">Không tải được học viên.</p>:displayedCandidates.items.length===0?<p>Không tìm thấy học viên.</p>:displayedCandidates.items.map(s=>{
     const enrolled=people.some(p=>p.id===s.id);
     return <button type="button" className={styles.lookupResult} data-tos-slot={tosSlotKeys(styles.lookupResult)} key={s.id}
      disabled={enrolled||!s.canAdd||adding} onClick={()=>void addExisting(s.id)}>
      <div><strong>{s.name} {genderBadge({gender:s.gender==="FEMALE"?"Nữ":s.gender==="MALE"?"Nam":"Khác / chưa cung cấp"})}</strong><small>{s.homeCenterName?"Chi nhánh: "+s.homeCenterName:"Chưa có chi nhánh"}{enrolled?" · Đã trong lớp":!s.canAdd?" · Không thể thêm":""}</small></div>
      <span aria-hidden="true">{enrolled?"✓":"+"}</span>
     </button>;
    })}{displayedCandidates?.more&&<button type="button" onClick={()=>setPageLimit(n=>n+50)}>Tải thêm</button>}
    {addError&&<p role="alert">Chưa xác nhận thêm học viên. Vui lòng thử lại.</p>}</>:<><p className={styles.smallMuted} data-tos-slot={tosSlotKeys(styles.smallMuted)}>Nhập thông tin để chuẩn bị. Chưa thể tạo hoặc thêm học viên khi thao tác chưa được mở.</p><label className={styles.field} data-tos-slot={tosSlotKeys(styles.field)}>Họ tên<input aria-label="Họ tên lead" value={newName} onChange={e=>setNewName(e.target.value)} placeholder="Tên học viên"/></label><div className={styles.fieldGrid} data-tos-slot={tosSlotKeys(styles.fieldGrid)}><label className={styles.field} data-tos-slot={tosSlotKeys(styles.field)}>Tuổi<input aria-label="Tuổi lead" type="number" min="1" max="18" value={newAge} onChange={e=>setNewAge(e.target.value)}/></label><label className={styles.field} data-tos-slot={tosSlotKeys(styles.field)}>Giới tính<select aria-label="Giới tính lead" value={newGender} onChange={e=>setNewGender(e.target.value as Gender)}>{(["Nữ","Nam","Khác / chưa cung cấp"] as Gender[]).map(g=><option key={g}>{g}</option>)}</select></label></div><button disabled title="Chức năng chưa khả dụng; chưa gửi dữ liệu" className={styles.primaryButtonWide} data-tos-slot={tosSlotKeys(styles.primaryButtonWide)} onClick={addLead}><FontAwesomeIcon icon={faUserPlus}/> Thêm lead vào buổi</button></>}</>}
   {overlay==="assign"&&<>
    {replacingDiaryId&&(()=>{const old=data.diaries.find(x=>x.id===replacingDiaryId);const entry=old?.missions.find(m=>m.id===replacingMissionId);return old&&entry?<div className={styles.replacementSummary} data-tos-slot={tosSlotKeys(styles.replacementSummary)} role="status"><strong><FontAwesomeIcon icon={faRotate}/> Đổi {entry.id} trong Diary Path {old.path}</strong><p>{entry.name} · {data.students.find(s=>s.id===old.studentId)?.name}</p><small>Diary ID không đổi · chỉ chọn Mission cùng Path.</small></div>:null})()}
    <label className={styles.field} data-tos-slot={tosSlotKeys(styles.field)}>Học viên
      <select aria-label="Học viên nhận Mission" value={studentId} disabled={!!replacingDiaryId} onChange={e=>{const nextId=e.target.value;setStudentId(nextId);const inPath=availableMission(nextId).find(m=>m.path===current?.path&&m.subject===current?.subject);setChosenMission(inPath?.id||"");}}>{people.map(s=><option key={s.id} value={s.id}>{genderLabel(s)} {s.name} · {s.age} tuổi</option>)}</select>
    </label>

    {unfinishedFor(studentId).filter(row=>!(row.diary.id===replacingDiaryId&&row.mission.id===replacingMissionId)).length>0&&<section className={styles.unfinishedWarning} data-tos-slot={tosSlotKeys(styles.unfinishedWarning)} aria-label="Cảnh báo nhiệm vụ chưa hoàn thành">
      <h3><FontAwesomeIcon icon={faTriangleExclamation}/> Nhiệm vụ đang dang dở</h3><p>Có thể tiếp tục Mission dang dở nếu đủ điều kiện bắt buộc trước đó.</p>
      {unfinishedFor(studentId).filter(row=>!(row.diary.id===replacingDiaryId&&row.mission.id===replacingMissionId)).map(({diary,mission:entry})=><div className={styles.unfinishedRow} data-tos-slot={tosSlotKeys(styles.unfinishedRow)} key={diary.id+"-"+entry.id}><div><strong>{entry.id} · {entry.name}</strong><small>{diary.status==="REGISTERED"?"Đang trong Diary":"Chưa hoàn thành ở buổi trước"} · Path {diary.path} · {dateLabel(diary.at)}</small>{diary.notes&&<p>Ghi chú: {diary.notes}</p>}</div><button type="button" disabled={!mission(entry.id)||!!mission(entry.id)&&missingCodes(mission(entry.id)!,studentId).length>0||!eligible.some(m=>m.id===entry.id)} onClick={()=>{setChosenMission(entry.id);setMissionSearch("")}}>Tiếp tục</button></div>)}
    </section>}


    <label className={styles.search} data-tos-slot={tosSlotKeys(styles.search)}><FontAwesomeIcon icon={faMagnifyingGlass}/><input aria-label="Tìm Mission" value={missionSearch} onChange={e=>setMissionSearch(e.target.value)} placeholder="Mã, tên hoặc Path..."/></label>
    {options.length===0?<p className={styles.empty} data-tos-slot={tosSlotKeys(styles.empty)}>{model.missionReadState==="LOADED"?"Không có nhiệm vụ thuộc Path của lớp.":"Chưa tải được danh mục Mission."}</p>:options.map(m=>{
      const missing=missingCodes(m,studentId);
      const owner=currentDiaries.find(d=>d.studentId===studentId&&d.path===m.path);
      const already=currentDiaries.some(d=>d.studentId===studentId&&d.missions.some(entry=>entry.id===m.id&&!(d.id===replacingDiaryId&&entry.id===replacingMissionId)));
      const sameOld=!!replacingDiaryId&&replacingMissionId===m.id;
      const missingDraft=!!owner&&owner.status==="REGISTERED"&&!canAppendToDiary(owner)&&!replacingDiaryId;
      const disabled=missing.length>0||already||sameOld||owner?.status==="CLOSED"||missingDraft||(!!replacingDiaryId&&owner?.id!==replacingDiaryId);
      const hint=missing.length?"Thiếu "+missing.join(", "):already?"Đã gán trong buổi":sameOld?"Mission hiện tại":owner?.status==="CLOSED"?"Diary Path đã đóng":missingDraft?"Hoàn thành Mission hiện tại rồi Lưu nháp Diary":owner?"Thêm vào Diary Path "+m.path:"Tạo Diary Path "+m.path;
      return <button type="button" className={(chosenMission===m.id?styles.missionChoiceActive:styles.missionChoice)+" "+(disabled?styles.missionChoiceDisabled:"")} data-tos-slot={tosSlotKeys((chosenMission===m.id?styles.missionChoiceActive:styles.missionChoice)+" "+(disabled?styles.missionChoiceDisabled:""))} key={m.id} disabled={disabled} aria-label={m.id+" · "+m.name+" — "+hint} title={hint} onClick={()=>setChosenMission(m.id)}>
        <div><strong>{m.id} · {m.name}</strong><small>{m.subject==="art"?"Mỹ thuật":"Piano"} · Path {m.path} · Cấp {m.level} · {plsText(m)}</small><em className={disabled?styles.amberText:styles.greenText} data-tos-slot={tosSlotKeys(disabled?styles.amberText:styles.greenText)}>{hint}</em></div><span>{disabled?"⊘":chosenMission===m.id?"◉":"○"}</span>
      </button>;
    })}
    {!!chosenMission&&selected&&<div className={styles.prereqBox} data-tos-slot={tosSlotKeys(styles.prereqBox)}><strong>{replacingDiaryId?"Đổi Nhiệm Vụ":"Nhiệm vụ được chọn"} · {chosenMission}</strong><p>{selected.prerequisites.length?"Yêu cầu: "+selected.prerequisites.join(", "):"Không yêu cầu Mission trước."}</p>{prerequisite(selected,studentId).map(r=><p key={r.code}>{r.ok?"✓ "+r.code+" · đã hoàn thành":"✕ Thiếu "+r.code}</p>)}</div>}

    <div className={styles.assignFooter} data-tos-slot={tosSlotKeys(styles.assignFooter)}><button className={styles.primaryButtonWide} data-tos-slot={tosSlotKeys(styles.primaryButtonWide)} disabled={!chosenMission||!mission(chosenMission)||!eligible.some(m=>m.id===chosenMission)||chosenMission===replacingMissionId} onClick={register}><FontAwesomeIcon icon={replacingDiaryId?faRotate:faCheck}/> {chosenMission?(replacingDiaryId?"Đổi Nhiệm Vụ":currentDiaries.some(d=>d.studentId===studentId&&d.path===selected?.path)?"Thêm Nhiệm Vụ":"Tạo Nhiệm Vụ"):"Tạo Nhiệm Vụ"}</button></div>
   </>}
   {overlay==="guide"&&(()=>{const d=data.diaries.find(x=>x.id===selectedDiary);const m=mission(selectedMissionId);const s=d&&data.students.find(x=>x.id===d.studentId);if(!m||!s||!d?.missions.some(x=>x.id===m.id))return null;return <><div className={styles.studentHead} data-tos-slot={tosSlotKeys(styles.studentHead)}>{avatar(s)}<div><strong>{s.name} {genderBadge(s)}</strong><p>Diary Path {d.path} · {d.missions.length} Mission</p></div></div><h3>Giáo án · {m.id}</h3><p>{m.description}</p><div className={styles.lessonMeta} data-tos-slot={tosSlotKeys(styles.lessonMeta)}><span>Cấp {m.level}</span><span>Path {m.path}</span><span title="Giá trị tham khảo từ danh mục; không cộng PLS tại đây.">{plsText(m)}</span></div><p className={styles.smallMuted} data-tos-slot={tosSlotKeys(styles.smallMuted)}>Chuẩn bị: {m.materials}</p><ol className={styles.guidelines} data-tos-slot={tosSlotKeys(styles.guidelines)}>{m.guideline.map((v,i)=><li key={i}>{v}</li>)}</ol><h3>Nhiệm vụ cần hoàn thành trước</h3>{prerequisite(m,s.id).map(r=><p className={r.ok?styles.greenText:styles.amberText} data-tos-slot={tosSlotKeys(r.ok?styles.greenText:styles.amberText)} key={r.code}>{r.ok?"✓ Đã hoàn thành: ":"Thiếu "}{r.code}</p>)}{m.prerequisites.length===0&&<p>Không yêu cầu nhiệm vụ trước.</p>}<h3>Các Mission chung Diary</h3>{d.missions.map(entry=><div className={styles.diaryMissionChips} data-tos-slot={tosSlotKeys(styles.diaryMissionChips)} key={entry.id}><span>{entry.id} · {entry.name}</span></div>)}</>})()}
   {overlay==="diary"&&(()=>{const d=data.diaries.find(x=>x.id===selectedDiary);const s=d&&data.students.find(x=>x.id===d.studentId);if(!d||!s)return null;return <>
     <div className={styles.studentHead} data-tos-slot={tosSlotKeys(styles.studentHead)}>{avatar(s)}<div><strong>{s.name} {genderBadge(s)}</strong><p>Nhật ký Path {d.path} · {d.missions.length} Mission</p>{badge(d)}</div></div>
     {d.status==="REGISTERED"&&d.draftSavedAt&&<div className={styles.draftSavedLine} data-tos-slot={tosSlotKeys(styles.draftSavedLine)} role="status"><FontAwesomeIcon icon={faCircleCheck}/> Nháp gần nhất: {dateLabel(d.draftSavedAt)} {timeLabel(d.draftSavedAt)} · {d.draftSavedBy||"Nhân sự"} · Phiên bản {d.version}</div>}
     {d.status==="REGISTERED"?<>
       <h3>1. Kết quả từng Mission ({d.missions.length})</h3>
       <div className={styles.multiMissionResults} data-tos-slot={tosSlotKeys(styles.multiMissionResults)} data-diary-result tabIndex={-1}>{d.missions.map((entry,index)=><section className={styles.missionOutcome} data-tos-slot={tosSlotKeys(styles.missionOutcome)} key={entry.id} data-diary-mission-result={entry.id}>
         <div className={styles.missionOutcomeHead} data-tos-slot={tosSlotKeys(styles.missionOutcomeHead)}><span>Nhiệm vụ {index+1}</span><strong>{entry.id} · {entry.name}</strong></div>
         <div className={styles.resultChoice} data-tos-slot={tosSlotKeys(styles.resultChoice)}><label className={styles.missionConfirmCheckbox} data-tos-slot={tosSlotKeys(styles.missionConfirmCheckbox)}><input type="checkbox" disabled title="Xác nhận hoàn tất qua luồng C1" checked={missionResults[entry.id]===true} onChange={event=>setMissionResults(previous=>({...previous,[entry.id]:event.target.checked?true:null}))}/><span>Nhiệm vụ hoàn tất</span></label></div>
       </section>)}</div>
       <h3>2. Trải nghiệm chung của Diary</h3>
       <fieldset className={styles.interestFieldset} data-tos-slot={tosSlotKeys(styles.interestFieldset)} data-diary-interest tabIndex={-1}><legend>Mức độ hứng thú <span aria-hidden="true">*</span></legend><p>Đánh giá tương tác chung trong ca học này, không phải mức độ hoàn thành từng nhiệm vụ.</p><div className={styles.interestRadioList} data-tos-slot={tosSlotKeys(styles.interestRadioList)}>{interactionOptions.map(option=><label key={option.value} className={interest===option.value?styles.interestRadioSelected:styles.interestRadio} data-tos-slot={tosSlotKeys(interest===option.value?styles.interestRadioSelected:styles.interestRadio)}><input type="radio" name="diary-interest" value={option.value} aria-label={"Mức "+option.value+" - "+option.label} checked={interest===option.value} onChange={()=>{setInterest(option.value);setFormErrors(errs=>errs.filter(x=>!x.includes("mức hứng thú")&&!x.includes("khó khăn")))}}/><span className={styles.interestRadioNumber} data-tos-slot={tosSlotKeys(styles.interestRadioNumber)}>{option.value}</span><span className={styles.interestRadioCopy}>{option.short}</span></label>)}</div><p className={styles.interestMeaning} aria-live="polite">{interest===null?"Chọn mức đánh giá từ 1 đến 4.":"Mức "+interest+": "+interactionOptions.find(option=>option.value===interest)?.label}</p></fieldset>
       {interest===1&&<label className={styles.field} data-tos-slot={tosSlotKeys(styles.field)} data-diary-difficulty tabIndex={-1}>Miêu tả khó khăn khi hướng dẫn học viên <span aria-hidden="true">*</span><textarea aria-label="Miêu tả khó khăn khi hướng dẫn học viên" required value={difficulty} onChange={e=>setDifficulty(e.target.value)} placeholder="Khó khăn khi hướng dẫn và cần hỗ trợ gì ở buổi sau?"/></label>}
       <label className={styles.field} data-tos-slot={tosSlotKeys(styles.field)} data-diary-notes tabIndex={-1}>3. Nhận xét, lưu ý chung cho Path *<textarea aria-label="Ghi chú Nhật ký" value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Tổng kết các Mission đã học, những điều làm tốt và cần tiếp tục..."/></label>
       <label className={styles.photoPicker} data-tos-slot={tosSlotKeys(styles.photoPicker)} data-diary-evidence tabIndex={-1}><FontAwesomeIcon icon={faCamera}/> 4. Ảnh bằng chứng chung * · Nhiều ảnh; video tùy chọn<input type="file" accept="image/*,video/*" multiple onChange={e=>{void addEvidence(e.target.files);e.target.value=""}}/></label>
       {evidence.map((x,i)=><div className={styles.fileItem} data-tos-slot={tosSlotKeys(styles.fileItem)} key={i}>{x.preview?<img src={x.preview} alt={x.name}/>:<FontAwesomeIcon icon={faCamera}/>}<span>{x.name}{x.kind==="video"?" · Video chưa gửi":""}</span><button aria-label={"Bỏ "+x.name} onClick={()=>setEvidence(p=>p.filter((_,j)=>j!==i))}>×</button></div>)}
       <div className={styles.diarySubmitFooter} data-tos-slot={tosSlotKeys(styles.diarySubmitFooter)}>
        {formErrors.length>0&&<div className={styles.validationErrors} data-tos-slot={tosSlotKeys(styles.validationErrors)} role="alert" data-diary-errors tabIndex={-1}><strong>Vui lòng bổ sung trước khi kết thúc:</strong>{formErrors.map(e=><p key={e}>• {e}</p>)}</div>}
        <div className={styles.diarySaveActions} data-tos-slot={tosSlotKeys(styles.diarySaveActions)}>
         <button disabled={!canWriteExistingDiary||diaryWriting||uploading} type="button" className={styles.saveDraftCta} data-tos-slot={tosSlotKeys(styles.saveDraftCta)} onClick={()=>void writeExistingDiary("draft")} aria-label="Lưu nháp Diary"><FontAwesomeIcon icon={faClipboardList}/> Lưu nháp</button>
         <button disabled={!canWriteExistingDiary||diaryWriting||uploading} type="button" className={styles.primaryButtonWide} data-tos-slot={tosSlotKeys(styles.primaryButtonWide)} onClick={()=>void writeExistingDiary("close")}><FontAwesomeIcon icon={faCheck}/> {uploading?"Đang xử lý ảnh...":"Kết thúc Diary"}</button>
        </div>
        <small className={styles.draftSaveHint} data-tos-slot={tosSlotKeys(styles.draftSaveHint)}>Lưu nháp không đóng Diary. Kết thúc Diary không bắt buộc mọi Nhiệm vụ hoàn tất; cần mức tương tác, ghi chú và ảnh.</small>
       </div>
      </>:<>
       <h3>Kết quả các Mission</h3>
       {d.missions.map(entry=><div className={styles.historyMission} data-tos-slot={tosSlotKeys(styles.historyMission)} key={entry.id}><strong>{entry.id} · {entry.name}</strong>{missionBadge(d,entry)}</div>)}
       <h3>Trải nghiệm & ghi chú chung</h3><p>{interestText(d.interest,d.closedAt)}</p><p className={styles.historyNotes} data-tos-slot={tosSlotKeys(styles.historyNotes)}>{d.notes||"Không có ghi chú."}</p><small>Đóng bởi {d.closedBy} · {dateLabel(d.closedAt||d.at)}</small>
       <section className={styles.historyEvidence} data-tos-slot={tosSlotKeys(styles.historyEvidence)}><h3><FontAwesomeIcon icon={faCamera}/> Ảnh / video chung</h3>{d.media?.some(e=>e.preview)?<div className={styles.evidenceGrid} data-tos-slot={tosSlotKeys(styles.evidenceGrid)}>{d.media.filter(e=>e.preview).map((e,i)=><figure key={i}><img src={e.preview} alt={"Bằng chứng "+e.name}/><figcaption>{e.name}</figcaption></figure>)}</div>:null}{(d.media||[]).filter(e=>!e.preview).map((e,i)=><div className={styles.evidenceFilename} data-tos-slot={tosSlotKeys(styles.evidenceFilename)} key={i}>{e.name}</div>)}{!d.media?.length&&<p className={styles.emptyEvidence} data-tos-slot={tosSlotKeys(styles.emptyEvidence)}>Chưa có ảnh xem trước.</p>}</section>
      </>}
    </>})()}

      {overlay==="photo"&&proofOpening&&proofClass&&<div className={styles.proofDetail} data-tos-slot={tosSlotKeys(styles.proofDetail)}>
    <div className={styles.proofHeading} data-tos-slot={tosSlotKeys(styles.proofHeading)}>
     <div><strong>{proofClass.name}</strong><p>{proofClass.time} · {proofClass.room}</p><p>Mở bởi {proofOpening.openedBy} · {dateLabel(proofOpening.openedAt)} {timeLabel(proofOpening.openedAt)}</p></div>
     <span className={styles.badgeGood} data-tos-slot={tosSlotKeys(styles.badgeGood)}>Lớp đã mở</span>
    </div>
    <div className={styles.proofStatusRow} data-tos-slot={tosSlotKeys(styles.proofStatusRow)}><span className={reviewState(proofOpening)==="REJECTED"?styles.badgeBad:reviewState(proofOpening)==="APPROVED"?styles.badgeGood:styles.badgePending} data-tos-slot={tosSlotKeys(reviewState(proofOpening)==="REJECTED"?styles.badgeBad:reviewState(proofOpening)==="APPROVED"?styles.badgeGood:styles.badgePending)}>Bằng chứng: {reviewText(reviewState(proofOpening))}</span><span>{evidenceRounds(proofOpening).reduce((n,r)=>n+r.photos.length,0)} ảnh · {evidenceRounds(proofOpening).length} lượt gửi</span></div>
    {needsAction(proofOpening)&&<div className={styles.proofRejected} data-tos-slot={tosSlotKeys(styles.proofRejected)} role="status"><strong><FontAwesomeIcon icon={faTriangleExclamation}/> Ảnh setup không được duyệt</strong><p>{lastRound(proofOpening)?.reason}</p><p>Staff có thể bổ sung ảnh mà không phải mở lớp lại.</p></div>}
    <h3>Bằng chứng và lịch sử duyệt</h3>
    {evidenceRounds(proofOpening).slice().reverse().map((round,index)=><article className={styles.proofRound} data-tos-slot={tosSlotKeys(styles.proofRound)} key={round.id} data-review-round-id={round.id}>
      <div className={styles.proofRoundHead} data-tos-slot={tosSlotKeys(styles.proofRoundHead)}><strong>{index===evidenceRounds(proofOpening).length-1?"Ảnh mở lớp ban đầu":"Lượt bằng chứng #"+(evidenceRounds(proofOpening).length-index)}</strong><span className={round.status==="REJECTED"?styles.badgeBad:round.status==="APPROVED"?styles.badgeGood:styles.badgePending} data-tos-slot={tosSlotKeys(round.status==="REJECTED"?styles.badgeBad:round.status==="APPROVED"?styles.badgeGood:styles.badgePending)}>{reviewText(round.status)}</span></div>
      <p>{dateLabel(round.submittedAt)} {timeLabel(round.submittedAt)} · Người gửi: {round.submittedBy}</p>
      {round.note&&<p>Ghi chú: {round.note}</p>}
      <div className={styles.proofGallery} data-tos-slot={tosSlotKeys(styles.proofGallery)}>
      {round.photos.map((photo,index)=><figure key={photo.id}>{proofOpening.receiptId?<PrivateClassOpeningImage key={proofOpening.receiptId+":"+photo.id} scope={classScope(proofClass)} receiptId={proofOpening.receiptId} assetId={photo.id} alt={index===0&&round.id===evidenceRounds(proofOpening)[0].id?"Ảnh setup đã lưu":"Ảnh setup "+photo.fileName}/>:<p>Chưa xác minh ảnh.</p>}<figcaption>{photo.fileName}<small>{photo.uploadedBy} · {timeLabel(photo.uploadedAt)}</small></figcaption></figure>)}
      </div>
      {round.reviewedAt&&<p className={styles.proofReviewNote} data-tos-slot={tosSlotKeys(styles.proofReviewNote)}>Duyệt bởi {round.reviewedBy} · {dateLabel(round.reviewedAt)} {timeLabel(round.reviewedAt)}</p>}
      {round.status==="REJECTED"&&<div className={styles.proofReason} data-tos-slot={tosSlotKeys(styles.proofReason)}>Lý do từ chối: {round.reason||"Chưa cung cấp lý do"}</div>}
      {round.status==="APPROVED"&&round.reason&&<p className={styles.proofReviewNote} data-tos-slot={tosSlotKeys(styles.proofReviewNote)}>{round.reason}</p>}
    </article>)}
    {!appendOpen?<button className={styles.primaryButtonWide} data-tos-slot={tosSlotKeys(styles.primaryButtonWide)} disabled={readOnly||!proofOpening.canAppend} onClick={()=>setAppendOpen(true)}><FontAwesomeIcon icon={faCamera}/> Thêm ảnh setup</button>:
      <section className={styles.proofComposer} data-tos-slot={tosSlotKeys(styles.proofComposer)}>
       <h3>Thêm ảnh setup cho lớp đã mở</h3>
       <p>Ảnh ban đầu và lịch sử duyệt được giữ nguyên. Bản dev hiện chỉ xác nhận được một ảnh mỗi lượt; nhiều ảnh và ghi chú chưa được gửi.</p>
       <div className={styles.proofPickers} data-tos-slot={tosSlotKeys(styles.proofPickers)}>
        <label className={styles.photoPicker} data-tos-slot={tosSlotKeys(styles.photoPicker)}><FontAwesomeIcon icon={faCamera}/> Chụp ảnh<input aria-label="Chụp thêm ảnh setup" type="file" accept="image/*" capture="environment" onChange={e=>{void handleSupplementPhotos(e.target.files);e.target.value=""}}/></label>
        <label className={styles.photoPicker} data-tos-slot={tosSlotKeys(styles.photoPicker)}><FontAwesomeIcon icon={faPlus}/> Chọn nhiều ảnh<input aria-label="Chọn nhiều ảnh setup" type="file" accept="image/*" multiple onChange={e=>{void handleSupplementPhotos(e.target.files);e.target.value=""}}/></label>
       </div>
       {draftPhotos.length>0&&<div className={styles.proofDraftGrid} data-tos-slot={tosSlotKeys(styles.proofDraftGrid)}>{draftPhotos.map(photo=><div key={photo.id}><img alt={"Ảnh bổ sung "+photo.fileName} src={photo.preview}/><button type="button" aria-label={"Bỏ ảnh "+photo.fileName} onClick={()=>setDraftPhotos(p=>p.filter(x=>x.id!==photo.id))}>×</button><span>{photo.fileName}</span></div>)}</div>}
       <label className={styles.field} data-tos-slot={tosSlotKeys(styles.field)}>Ghi chú về thay đổi setup (tùy chọn)<textarea aria-label="Ghi chú ảnh setup bổ sung" value={draftNote} onChange={e=>setDraftNote(e.target.value)} placeholder="Ví dụ: Đã chỉnh lại bàn ghế và ánh sáng."/></label>
       <button disabled={readOnly||appendBusy||!proofOpening.canAppend||draftPhotos.length!==1||!!draftNote.trim()} className={styles.primaryButtonWide} data-tos-slot={tosSlotKeys(styles.primaryButtonWide)} onClick={()=>void submitSupplement()}>{appendBusy?"Đang xử lý ảnh...":needsAction(proofOpening)?"Gửi bổ sung để duyệt lại":"Gửi ảnh setup bổ sung"}</button>
       <button className={styles.cancel} data-tos-slot={tosSlotKeys(styles.cancel)} onClick={()=>{setAppendOpen(false);setDraftPhotos([]);setDraftNote("")}}>Hủy bổ sung</button>
      </section>}
    <p className={styles.smallMuted} data-tos-slot={tosSlotKeys(styles.smallMuted)}>Thông tin bằng chứng chỉ hiển thị khi được Core xác minh. Ảnh mới chọn chưa được gửi.</p>
   </div>}

   </section>{discardConfirm&&<div className={styles.discardMask} data-tos-slot={tosSlotKeys(styles.discardMask)} role="alertdialog" aria-modal="true" aria-label="Bỏ thay đổi Nhật ký?" aria-describedby="diary-discard-message"><div className={styles.discardCard} data-tos-slot={tosSlotKeys(styles.discardCard)}><div className={styles.discardIcon} data-tos-slot={tosSlotKeys(styles.discardIcon)}><FontAwesomeIcon icon={faTriangleExclamation}/></div><h2>Bạn chưa lưu Nhật ký</h2><p id="diary-discard-message">Nhận xét, lựa chọn và ảnh vừa thêm sẽ bị mất nếu bạn rời khỏi màn hình này.</p><div className={styles.discardActions} data-tos-slot={tosSlotKeys(styles.discardActions)}><button type="button" onClick={()=>setDiscardConfirm(false)}>Tiếp tục nhập</button><button type="button" onClick={discardDiaryEdits}>Bỏ thay đổi</button></div></div></div>}</AppModalRoot>}
   {missionGateDiaryId&&(()=>{
    const blocked=data.diaries.find(d=>d.id===missionGateDiaryId);
    return <AppModalRoot className={styles.missionGateMask} data-tos-slot={tosSlotKeys(styles.missionGateMask)} onClose={()=>setMissionGateDiaryId("")}>
     <section className={styles.missionGateCard} data-tos-slot={tosSlotKeys(styles.missionGateCard)} role="alertdialog" aria-modal="true" aria-label="Chưa thể thêm nhiệm vụ" aria-describedby="mission-gate-message">
      <div className={styles.missionGateIcon} data-tos-slot={tosSlotKeys(styles.missionGateIcon)}><FontAwesomeIcon icon={faInfoCircle}/></div>
      <h2>{blocked?.status==="CLOSED"?"Diary đã kết thúc":"Chưa thể thêm nhiệm vụ"}</h2>
      <p id="mission-gate-message">{blocked?.status==="CLOSED"?"Diary này đã kết thúc. Không thể thêm nhiệm vụ mới vào cùng Path trong ca học này.":<>Muốn thêm Mission cùng Path: mở tab <strong>Nhật ký</strong>, chọn <strong>Hoàn thành</strong> cho tất cả Mission hiện có và bấm <strong>Lưu nháp</strong>.</>}</p>
      <div className={styles.missionGateActions} data-tos-slot={tosSlotKeys(styles.missionGateActions)}>
       <button type="button" data-mission-gate-close onClick={()=>setMissionGateDiaryId("")}>Đóng</button>
       {blocked?.status==="REGISTERED"&&<button type="button" className={styles.missionGatePrimary} data-tos-slot={tosSlotKeys(styles.missionGatePrimary)} onClick={()=>{setMissionGateDiaryId("");setTab("diaries");openDiary(blocked)}}>Mở Nhật ký <FontAwesomeIcon icon={faChevronRight}/></button>}
      </div>
     </section>
    </AppModalRoot>
   })()}
   {message&&<AppToast className={styles.toast} data-tos-slot={tosSlotKeys(styles.toast)}><FontAwesomeIcon icon={faInfoCircle}/> {message}</AppToast>}
 </div></main>;
}
