"use client";
/** PAP-1488 / PAP-1676: approved TOS Classroom Nhiệm Vụ tab,
 * Core Assignment IDs (not Diary child records). Approved card and sheet CSS only.
 */
import {useCallback,useEffect,useRef,useState} from "react";
import {FontAwesomeIcon,faBookOpen,faCheck,faRotate,faXmark} from "./classroom-icons";
import styles from "./classroom.module.css";
import {AppModalRoot,createSlotKeys} from "../tos-ds";
import {
  startMissionAssignmentTabRead,missionTabReadMessage,
  type MissionTabReadState,type MissionTabScope,
} from "@/lib/tos-mission-assignment-tab-read";
import type {TosMissionAssignmentCard} from "@/lib/tos-mission-assignment-card-model";
import type {TosEligibleMissionChoice} from "@/lib/tos-mission-assignment-choices";
import {readTosNewMissionGuard} from "@/lib/tos-mission-completion-read";
import {
  getTosMissionCommandChoices,createTosMissionAssignmentVerified,
  replaceTosMissionAssignmentVerified,
} from "@/lib/tos-mission-assignment-command-runtime";

const slot=createSlotKeys(styles);
type MissionCreateRequest={id:number;studentId:string};
type Editor={studentId:string;old:TosMissionAssignmentCard|null};
type Choices={phase:"loading"|"ready"|"error";items:readonly TosEligibleMissionChoice[]};
type CreateGate="loading"|"clear"|"unfinished"|"unavailable";
export default function MissionAssignmentTab({
  scope,readOnly=false,visible=true,createRequest=null,onCreateRequestConsumed,
}:{scope:MissionTabScope;readOnly?:boolean;visible?:boolean;
  createRequest?:MissionCreateRequest|null;onCreateRequestConsumed?:(requestId:number)=>void}){
  const [read,setRead]=useState<MissionTabReadState>({state:"LOADING",groups:[]});
  const [attempt,setAttempt]=useState(0);
  const [editor,setEditor]=useState<Editor|null>(null);
  const [choices,setChoices]=useState<Choices>({phase:"loading",items:[]});
  const [chosen,setChosen]=useState("");
  const [createGate,setCreateGate]=useState<CreateGate>("loading");
  const [busy,setBusy]=useState(false);
  const submitting=useRef(false);
  const consumedCreateRequest=useRef<number|null>(null);
  const [error,setError]=useState("");
  const {centerId,localDate,runningClassId,teachingContextKey}=scope;
  const groups=read.state==="READY"||read.state==="EMPTY"?read.groups:[];
  const count=read.state==="READY"||read.state==="EMPTY"?
    groups.reduce((n,g)=>n+g.cards.length,0):"—";
  const canWrite=!readOnly&&read.state!=="UNAVAILABLE"&&read.state!=="LOADING"&&
    groups.length>0;
  useEffect(()=>startMissionAssignmentTabRead({
    centerId,localDate,runningClassId,teachingContextKey,
  },setRead),[centerId,localDate,runningClassId,teachingContextKey,attempt]);
  const scopeFor=(studentId:string)=>({...scope,studentId});
  useEffect(()=>{
    if(!editor)return;
    let active=true;
    const controller=new AbortController();
    // PAP-1851: do NOT request or show eligible Mission choices on new Create until
    // every current-context Assignment has independent Core C1 completion proof.
    setChoices({phase:"loading",items:[]});
    setCreateGate(editor.old?"clear":"loading");
    const load=async()=>{
      if(!editor.old){
        const state=await readTosNewMissionGuard(
          {centerId,localDate,runningClassId,teachingContextKey,studentId:editor.studentId},
          undefined,controller.signal,
        );
        if(!active)return;
        if(state==="UNFINISHED"){setCreateGate("unfinished");return;}
        setCreateGate("clear");
      }
      const items=await getTosMissionCommandChoices(
        {centerId,localDate,runningClassId,teachingContextKey,studentId:editor.studentId},
      );
      if(active)setChoices({phase:"ready",items});
    };
    void load().catch(()=>{
      if(!active)return;
      if(editor.old)setChoices({phase:"error",items:[]});
      else setCreateGate("unavailable");
    });
    return()=>{active=false;controller.abort()};
  },[editor,centerId,localDate,runningClassId,teachingContextKey]);
  const open=useCallback((studentId:string,old:TosMissionAssignmentCard|null=null)=>{
    if(!canWrite||submitting.current)return;
    if(!groups.some(g=>g.studentId===studentId))return;
    setChoices({phase:"loading",items:[]});setChosen("");setError("");setEditor({studentId,old});
  },[canWrite,groups]);
  // PAP-1850: Student-tab action reuses this editor; consume only after Core roster read.
  useEffect(()=>{
    if(!createRequest||consumedCreateRequest.current===createRequest.id||!canWrite||
      !groups.some(g=>g.studentId===createRequest.studentId))return;
    consumedCreateRequest.current=createRequest.id;
    open(createRequest.studentId);
    onCreateRequestConsumed?.(createRequest.id);
  },[createRequest,canWrite,groups,open,onCreateRequestConsumed]);
  const close=()=>{if(!submitting.current){setEditor(null);setError("")}};
  const submit=async()=>{
    if(!editor||submitting.current||readOnly||(!editor.old&&createGate!=="clear")||choices.phase!=="ready"||
       !choices.items.some(x=>x.missionId===chosen))return;
    submitting.current=true;setBusy(true);setError("");
    try{
      if(editor.old){
        const selected=choices.items.find(x=>x.missionId===chosen)!;
        const reason="Đổi nhiệm vụ "+editor.old.missionCodeSnapshot+" sang "+selected.code+
          " theo lựa chọn giáo viên tại TOS";
        const result=await replaceTosMissionAssignmentVerified(
          scopeFor(editor.studentId),editor.old.assignmentId,editor.old.version,
          chosen,reason,crypto.randomUUID(),crypto.randomUUID(),
        );
        if(result.state==="PENDING_CREATE"){
          setError("Đã hủy nhiệm vụ trước nhưng chưa xác minh được nhiệm vụ thay thế. "+
            "Không tự gửi lại. Vui lòng kiểm tra với quản lý.");
          return;
        }
      }else{
        await createTosMissionAssignmentVerified(
          scopeFor(editor.studentId),chosen,crypto.randomUUID(),
        );
      }
      setEditor(null);setAttempt(x=>x+1);
    }catch(err){
      const code=err&&typeof err==="object"&&"status" in err?
        Number((err as {status:unknown}).status):0;
      setError(code===401?"Phiên đăng nhập hết hạn.":code===403?
        "Bạn chưa có quyền giao Nhiệm Vụ cho học viên/lớp này.":code===409?
        "Dữ liệu Nhiệm Vụ đã thay đổi. Vui lòng đóng và tải lại.":
        "Không xác minh được kết quả ghi. Không tự thử lại; vui lòng tải lại và kiểm tra.");
    }finally{submitting.current=false;setBusy(false)}
  };
  const studentName=editor?groups.find(g=>g.studentId===editor.studentId)?.studentName:"";
  return <><section hidden={!visible} role={visible?"tabpanel":undefined} id="tos-classroom-panel-missions"
    aria-labelledby="tos-classroom-tab-missions" aria-busy={read.state==="LOADING"}>
    <div className={styles.sectionHead} data-tos-slot={slot(styles.sectionHead)}>
      <div><h2>Nhiệm vụ hôm nay ({count})</h2></div>
      <button type="button" className={styles.missionAddAction} aria-label="Thêm Nhiệm Vụ" disabled={!canWrite}
        onClick={()=>{if(groups.length===1)open(groups[0]!.studentId);
          else if(groups.length>1)open(groups[0]!.studentId)}}>
        Thêm
      </button>
    </div>
    {read.state==="LOADING"&&<p role="status" className={styles.empty}
      data-tos-slot={slot(styles.empty)}>Đang tải nhiệm vụ đã giao…</p>}
    {read.state==="UNAVAILABLE"&&<p role="alert" className={styles.empty}
      data-tos-slot={slot(styles.empty)}>{missionTabReadMessage(read.error)}</p>}
    {read.state==="UNAVAILABLE"&&<button type="button" className={styles.missionReadRetry}
      onClick={()=>setAttempt(x=>x+1)}>Tải lại nhiệm vụ</button>}
    {read.state==="EMPTY"&&<p role="status" className={styles.empty}
      data-tos-slot={slot(styles.empty)}>Chưa có nhiệm vụ được giao.</p>}
    {groups.filter(g=>g.cards.length>0).map(group=><section className={styles.missionBatch}
      data-tos-slot={slot(styles.missionBatch)} key={group.studentId}
      aria-label={"Nhiệm vụ của "+group.studentName}>
      <div className={styles.missionBatchHead} data-tos-slot={slot(styles.missionBatchHead)}>
        <div><strong>{group.studentName}</strong><small>{group.cards.length} nhiệm vụ</small></div>
      </div>
      {group.cards.map(card=><article className={styles.missionCompactRow}
        data-tos-slot={slot(styles.missionCompactRow)} key={card.assignmentId}
        data-assignment-id={card.assignmentId} data-assignment-status={card.status}
        data-assignment-version={card.version} data-mission-id={card.missionId}>
        <div className={styles.missionCompactSummary} data-tos-slot={slot(styles.missionCompactSummary)}>
          <div className={styles.missionCompactName} data-tos-slot={slot(styles.missionCompactName)}>
            <strong>{card.missionCodeSnapshot} · {card.missionNameSnapshot}</strong>
            <span>Đã giao</span>
          </div>
          {card.contextLabel&&<small>{card.contextLabel}</small>}
        </div>
        <div className={styles.missionCompactActions} data-tos-slot={slot(styles.missionCompactActions)}>
          <button type="button" className={styles.missionPrimaryCta}
            data-tos-slot={slot(styles.missionPrimaryCta)}
            aria-label={"Giáo Án "+card.missionCodeSnapshot}
            disabled title="Chưa tải được giáo án.">
            <FontAwesomeIcon icon={faBookOpen}/> Giáo Án
          </button>
          <button type="button" className={styles.missionNextCta}
            data-tos-slot={slot(styles.missionNextCta)}
            aria-label={"Thêm nhiệm vụ sau "+card.missionCodeSnapshot}
            disabled={!canWrite} onClick={()=>open(group.studentId)}>
            Thêm
          </button>
          <button type="button" className={styles.missionSwapCta}
            data-tos-slot={slot(styles.missionSwapCta)}
            aria-label={"Đổi nhiệm vụ "+card.missionCodeSnapshot}
            disabled={!canWrite} onClick={()=>open(group.studentId,card)}>
            <FontAwesomeIcon icon={faRotate}/> Đổi
          </button>
        </div>
      </article>)}
    </section>)}
    </section>
    {!visible&&createRequest&&read.state==="UNAVAILABLE"&&<div role="alert"
      className={styles.missionReadError}>
      <p>{missionTabReadMessage(read.error)}</p>
      <button type="button" className={styles.missionReadRetry}
        onClick={()=>setAttempt(x=>x+1)}>Tải lại nhiệm vụ</button>
    </div>}
    {!visible&&createRequest&&(read.state==="READY"||read.state==="EMPTY")&&
      !groups.some(g=>g.studentId===createRequest.studentId)&&<p role="alert"
      className={styles.missionReadError}>Học viên chưa đủ điều kiện giao nhiệm vụ tại lớp này.</p>}
    {editor&&<AppModalRoot className={styles.scrim+" "+styles.missionEditorScrim} data-tos-slot={slot(styles.scrim)}
      onClose={close}>
      <section className={styles.sheet} data-tos-slot={slot(styles.sheet)}
        role="dialog" aria-modal="true" aria-label={editor.old?"Đổi nhiệm vụ":"Thêm Nhiệm Vụ"}>
        <div className={styles.handle} data-tos-slot={slot(styles.handle)}/>
        <header><h2>{editor.old?"Đổi nhiệm vụ":"Thêm Nhiệm Vụ"}</h2>
          <button type="button" aria-label="Đóng" disabled={busy} onClick={close}>
            <FontAwesomeIcon icon={faXmark}/>
          </button>
        </header>
        <label className={styles.field} data-tos-slot={slot(styles.field)}>
          Học viên
          <select aria-label="Học viên nhận Mission" value={editor.studentId}
            disabled={readOnly||busy||!!editor.old}
            onChange={e=>{setChoices({phase:"loading",items:[]});setChosen("");setError("");setEditor({studentId:e.target.value,old:null})}}>
            {groups.map(g=><option value={g.studentId} key={g.studentId}>{g.studentName}</option>)}
          </select>
        </label>
        {editor.old&&<p className={styles.smallMuted} data-tos-slot={slot(styles.smallMuted)}>
          Thay {editor.old.missionCodeSnapshot} · {editor.old.missionNameSnapshot} của {studentName}.
        </p>}
        {!editor.old&&createGate==="loading"&&<p role="status">
          Đang kiểm tra nhiệm vụ chưa hoàn thành…
        </p>}
        {!editor.old&&createGate==="unfinished"&&<div role="status"
          className={styles.missionReadError}>
          <strong>Còn nhiệm vụ chưa hoàn thành</strong>
        </div>}
        {!editor.old&&createGate==="unavailable"&&<p role="alert"
          className={styles.missionReadError}>
          Chưa xác minh được trạng thái nhiệm vụ. Vui lòng đóng và mở lại.
        </p>}
        {(!!editor.old||createGate==="clear")&&<>
        {choices.phase==="loading"&&<p role="status">Đang tải Mission đủ điều kiện…</p>}
        {choices.phase==="error"&&<p role="alert">
          Chưa tải được Mission đủ điều kiện từ Core. Vui lòng đóng và thử lại.
        </p>}
        {choices.phase==="ready"&&choices.items.length===0&&<p role="status">
          Không có Mission đủ điều kiện để giao.
        </p>}
        {choices.phase==="ready"&&choices.items.map(item=><button type="button"
          className={chosen===item.missionId?styles.missionChoiceActive:styles.missionChoice}
          data-tos-slot={slot(chosen===item.missionId?
            styles.missionChoiceActive:styles.missionChoice)}
          disabled={busy} aria-pressed={chosen===item.missionId} key={item.missionId}
          onClick={()=>setChosen(item.missionId)}>
          <div><strong>{item.code} · {item.name}</strong>
            <small>Cấp {item.level}</small>
          </div><span aria-hidden="true">{chosen===item.missionId?"◉":"○"}</span>
        </button>)}
        {error&&<p role="alert" className={styles.amberText}>{error}</p>}
        <div className={styles.assignFooter} data-tos-slot={slot(styles.assignFooter)}>
          <button type="button" className={styles.primaryButtonWide}
            data-tos-slot={slot(styles.primaryButtonWide)}
            disabled={busy||!chosen||choices.phase!=="ready"||!!error}
            onClick={()=>{void submit()}}>
            <FontAwesomeIcon icon={editor.old?faRotate:faCheck}/>
            {busy?"Đang xác minh…":editor.old?"Đổi Nhiệm Vụ":"Tạo Nhiệm Vụ"}
          </button>
        </div></>}
      </section>
    </AppModalRoot>}
  </>;
}
