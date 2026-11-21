"use client";

import {useEffect,useMemo,useState} from "react";
import {defaultTable,type BoField,type BoModule,type BoRecord,type BoTableState} from "@/lib/bo-registration";
import type {TablePolicy} from "@/app/components/workspace-renderer/TablePolicy";
import {DrawerFrame} from "@/app/components/workspace-renderer/DrawerFrame";
import {BoDataTable} from "./BoDataTable";
import {BoQuickView} from "./BoQuickView";
import {readStudentPathDiaries,type StudentPathDiary,type StudentPathDiaryMissionLink} from "@/lib/bo-student-path-diary";
import {formatPinoDateTime} from "@/lib/pino-datetime";

const tableFields:BoField[]=[
  {key:"action",label:"Thao tác",type:"text",icon:"Aa",w:150,readonly:true},
  {key:"missionName",label:"Nhiệm vụ",type:"relation",icon:"↗",w:270,readonly:true},
  {key:"registeredAt",label:"Ghi nhận lúc",type:"datetime",icon:"⌁",w:180,readonly:true},
  {key:"runningClassName",label:"Bối cảnh",type:"text",icon:"Aa",w:200,readonly:true},
  {key:"interest",label:"Mức độ hứng thú",type:"number",icon:"#",w:150,readonly:true},
  {key:"difficulty",label:"Khó khăn",type:"text",icon:"Aa",w:220,readonly:true},
  {key:"notes",label:"Ghi chú",type:"text",icon:"Aa",w:280,readonly:true},
  {key:"statusLabel",label:"Trạng thái",type:"text",icon:"◉",w:140,readonly:true},
  {key:"version",label:"Phiên bản",type:"number",icon:"#",w:110,readonly:true},
  {key:"registeredByDisplayName",label:"Người ghi nhận",type:"text",icon:"Aa",w:180,readonly:true},
  {key:"updatedAt",label:"Cập nhật lúc",type:"datetime",icon:"⌁",w:180,readonly:true},
  {key:"updatedByDisplayName",label:"Cập nhật bởi",type:"text",icon:"Aa",w:180,readonly:true},
  {key:"closedAt",label:"Đóng lúc",type:"datetime",icon:"⌁",w:180,readonly:true},
];

export const diaryRawModule:BoModule={
  label:"Diary raw",
  group:"LEARNING",
  fields:[
    {key:"id",label:"Diary ID (raw)",type:"id",icon:"#",w:190,readonly:true},
    {key:"studentName",label:"Học viên liên kết",type:"text",icon:"Aa",w:190,readonly:true},
    {key:"studentProfileId",label:"Student Profile ID (raw)",type:"id",icon:"#",w:190,readonly:true},
    {key:"centerId",label:"Center ID (raw)",type:"id",icon:"#",w:190,readonly:true},
    {key:"teachingContextKey",label:"Teaching Context Key",type:"text",icon:"Aa",w:190,readonly:true},
    {key:"pathKey",label:"Path Key",type:"text",icon:"Aa",w:190,readonly:true},
    {key:"runningClassId",label:"Running Class ID (raw)",type:"id",icon:"#",w:190,readonly:true},
    {key:"runningClassName",label:"Lớp / bối cảnh",type:"text",icon:"Aa",w:190,readonly:true},
    {key:"missionName",label:"Nhiệm vụ liên kết",type:"relation",icon:"↗",w:190,readonly:true},
    {key:"missionLinkIds",label:"Diary–Mission Link IDs (raw)",type:"text",icon:"#",w:190,readonly:true},
    {key:"missionIds",label:"Mission IDs (raw)",type:"text",icon:"#",w:190,readonly:true},
    {key:"assignmentIds",label:"Mission Assignment IDs (raw)",type:"text",icon:"#",w:190,readonly:true},
    {key:"statusRaw",label:"Trạng thái",type:"text",icon:"◉",w:190,readonly:true},
    {key:"interest",label:"Mức độ hứng thú (1–4)",type:"number",icon:"#",w:190,readonly:true},
    {key:"notes",label:"Ghi chú",type:"textarea",icon:"Aa",w:190,readonly:true},
    {key:"difficulty",label:"Khó khăn",type:"textarea",icon:"Aa",w:190,readonly:true},
    {key:"registeredAt",label:"Registered At",type:"datetime",icon:"⌁",w:190,readonly:true},
    {key:"registeredByDisplayName",label:"Người ghi nhận",type:"text",icon:"Aa",w:190,readonly:true},
    {key:"registeredByUserId",label:"Registered By User ID (raw)",type:"id",icon:"#",w:190,readonly:true},
    {key:"draftSavedAt",label:"Draft Saved At",type:"datetime",icon:"⌁",w:190,readonly:true},
    {key:"draftSavedByUserId",label:"Draft Saved By User ID (raw)",type:"id",icon:"#",w:190,readonly:true},
    {key:"draftSavedVersion",label:"Draft Saved Version",type:"number",icon:"#",w:190,readonly:true},
    {key:"closedAt",label:"Closed At",type:"datetime",icon:"⌁",w:190,readonly:true},
    {key:"closedByUserId",label:"Closed By User ID (raw)",type:"id",icon:"#",w:190,readonly:true},
    {key:"updatedAt",label:"Last Modified Time",type:"datetime",icon:"⌁",w:190,readonly:true},
    {key:"updatedByDisplayName",label:"Last Modified By",type:"text",icon:"Aa",w:190,readonly:true},
    {key:"version",label:"Diary version",type:"number",icon:"#",w:190,readonly:true},
  ],
};

export const missionRawModule:BoModule={
  label:"Nhiệm vụ raw",
  group:"LEARNING",
  fields:[
    {key:"id",label:"Mission ID (raw)",type:"id",icon:"#",w:190,readonly:true},
    {key:"missionCode",label:"Mã nhiệm vụ",type:"text",icon:"Aa",w:190,readonly:true},
    {key:"missionName",label:"Tên nhiệm vụ",type:"text",icon:"Aa",w:190,readonly:true},
    {key:"missionLevel",label:"Cấp",type:"number",icon:"#",w:190,readonly:true},
    {key:"missionStatus",label:"Trạng thái",type:"text",icon:"Aa",w:190,readonly:true},
    {key:"missionDescription",label:"Mô tả",type:"textarea",icon:"Aa",w:190,readonly:true},
    {key:"missionGuideline",label:"Hướng dẫn giáo viên",type:"textarea",icon:"Aa",w:190,readonly:true},
    {key:"missionPlsValue",label:"Giá trị PLS",type:"number",icon:"#",w:190,readonly:true},
    {key:"missionPaperSize",label:"Khổ giấy",type:"text",icon:"Aa",w:190,readonly:true},
    {key:"missionPathProgramId",label:"Path Program ID (raw)",type:"id",icon:"#",w:190,readonly:true},
    {key:"missionPathKeySnapshot",label:"Path snapshot",type:"text",icon:"Aa",w:190,readonly:true},
    {key:"missionPrerequisiteMissionId",label:"Prerequisite Mission ID (raw)",type:"id",icon:"#",w:190,readonly:true},
    {key:"missionPrerequisiteCodeSnapshot",label:"Prerequisite Code snapshot",type:"text",icon:"Aa",w:190,readonly:true},
    {key:"missionReconciliation",label:"Reconciliation",type:"text",icon:"Aa",w:190,readonly:true},
    {key:"missionDiagnostics",label:"Diagnostics",type:"textarea",icon:"Aa",w:190,readonly:true},
    {key:"missionVersion",label:"Phiên bản",type:"number",icon:"#",w:190,readonly:true},
    {key:"missionCreatedAt",label:"Created Time",type:"datetime",icon:"⌁",w:190,readonly:true},
    {key:"missionUpdatedAt",label:"Last Modified Time",type:"datetime",icon:"⌁",w:190,readonly:true},
  ],
};

const diaryTableModule:BoModule={...diaryRawModule,label:"Diary",fields:tableFields};
const diaryTablePolicy:TablePolicy={
  identity:"missionName",search:["missionName","runningClassName","notes","difficulty"],
  filter:["statusLabel"],sort:["registeredAt","interest","statusLabel"],group:["statusLabel"],edit:[],viewActions:[],
};

type RelationByDiary=ReadonlyMap<string,readonly StudentPathDiaryMissionLink[]>;
function displayTime(value:string|null|undefined):string{
  if(!value||!Number.isFinite(Date.parse(value)))return "—";
  return formatPinoDateTime(value);
}
function missionLabel(links:readonly StudentPathDiaryMissionLink[]):string{
  return links.length?links.map(link=>link.missionCode+" — "+link.missionName).join(" · "):"Chưa liên kết nhiệm vụ";
}
function rowFromDiary(diary:StudentPathDiary,studentName:string):BoRecord{
  const links=diary.missionLinks;
  return {
    id:diary.id,name:"Diary · "+displayTime(diary.registeredAt),action:"↗ Mở Diary raw",
    studentName,studentProfileId:diary.studentId,centerId:diary.centerId,
    teachingContextKey:diary.teachingContextKey,pathKey:diary.pathKey,
    runningClassId:diary.runningClassId,runningClassName:diary.runningClassDisplayName??"Buổi học",
    missionName:missionLabel(links),missionLinkIds:links.map(link=>link.id).join(" · "),
    missionIds:links.map(link=>link.missionId).join(" · "),
    assignmentIds:links.map(link=>link.assignmentId??"—").join(" · "),
    statusRaw:diary.status,statusLabel:diary.status==="CLOSED"?"Đã đóng":"Đã ghi nhận",
    interest:diary.interest,notes:diary.notes??"—",difficulty:diary.difficulty??"—",
    registeredAt:diary.registeredAt,registeredByDisplayName:diary.registeredByDisplayName??"—",
    registeredByUserId:diary.registeredByUserId,draftSavedAt:diary.draftSavedAt,
    draftSavedByUserId:diary.draftSavedByUserId,draftSavedVersion:diary.draftSavedVersion,
    closedAt:diary.closedAt,closedByUserId:diary.closedByUserId,
    updatedAt:diary.updatedAt,updatedByDisplayName:"—",version:diary.version,
  };
}
function missionRawRecord(value:Record<string,unknown>):BoRecord{
  const code=typeof value.code==="string"?value.code:"";
  const name=typeof value.name==="string"?value.name:"";
  const text=(key:string)=>typeof value[key]==="string"?value[key] as string:null;
  const number=(key:string)=>typeof value[key]==="number"?value[key] as number:null;
  const diagnostics=Array.isArray(value.diagnostics)?JSON.stringify(value.diagnostics):null;
  return {
    id:String(value.id),name:code+" — "+name,
    missionCode:code,missionName:name,missionLevel:number("level"),missionStatus:text("status"),
    missionDescription:text("description"),missionGuideline:text("guideline"),
    missionPlsValue:number("plsValue"),missionPaperSize:text("paperSize"),
    missionPathProgramId:text("pathProgramId"),missionPathKeySnapshot:text("pathKeySnapshot"),
    missionPrerequisiteMissionId:text("prerequisiteMissionId"),
    missionPrerequisiteCodeSnapshot:text("prerequisiteCodeSnapshot"),
    missionReconciliation:text("reconciliation"),missionDiagnostics:diagnostics,
    missionVersion:number("version"),missionCreatedAt:text("createdAt"),missionUpdatedAt:text("updatedAt"),
  };
}
function reviewMissionRecord(link:StudentPathDiaryMissionLink,diaryId:string):BoRecord{
  return {
    id:link.missionId,name:link.missionCode+" — "+link.missionName,diaryRecordId:diaryId,
    missionCode:link.missionCode,missionName:link.missionName,missionLevel:1,missionStatus:link.missionStatus,
    missionDescription:"Giữ nhịp đều ở đoạn chuyển hợp âm.",
    missionGuideline:"Làm mẫu chậm; tăng tốc sau khi nhịp đã ổn định.",
    missionPlsValue:0,missionPaperSize:"A4",missionPathProgramId:"qa-path",
    missionPathKeySnapshot:"Piano Core",missionPrerequisiteMissionId:null,
    missionPrerequisiteCodeSnapshot:null,missionReconciliation:"READY",
    missionDiagnostics:"[]",missionVersion:1,missionCreatedAt:"",missionUpdatedAt:"",
  };
}
async function readMission(fetcher:typeof fetch,centerId:string,missionId:string):Promise<BoRecord>{
  const query=new URLSearchParams({centerId});
  const response=await fetcher("/api/bo/learning/missions/"+encodeURIComponent(missionId)+"?"+query,{
    method:"GET",cache:"no-store",
  });
  if(!response.ok)throw Error("Không thể đọc Nhiệm vụ ("+response.status+").");
  const body:unknown=await response.json();
  if(!body||typeof body!=="object"||Array.isArray(body)||!("data" in body))throw Error("Phản hồi Nhiệm vụ không hợp lệ.");
  const value=body.data;
  if(!value||typeof value!=="object"||Array.isArray(value)||
    (value as Record<string,unknown>).id!==missionId||
    typeof (value as Record<string,unknown>).code!=="string"||
    typeof (value as Record<string,unknown>).name!=="string")
    throw Error("Nhiệm vụ trả về không khớp entity được liên kết.");
  return missionRawRecord(value as Record<string,unknown>);
}

function reviewRow(studentName:string):{row:BoRecord;links:StudentPathDiaryMissionLink[]}{
  const diaryId="qa-diary",link:StudentPathDiaryMissionLink={
    id:"qa-diary-mission-link",diaryId,missionId:"qa-mission",missionCode:"M-PN-01",
    missionName:"Luyện nhịp cơ bản",missionStatus:"ACTIVE",assignmentId:"qa-assignment",
    linkedAt:"2026-11-20T11:00:00.000Z",linkedByUserId:"qa-teacher",
  };
  const diary={id:diaryId,centerId:"qa-center",studentId:"qa-student",studentDisplayName:studentName,
    teachingContextKey:"qa-session:2026-11-20",pathKey:"pianohouse",runningClassId:"qa-class",
    runningClassDisplayName:"Piano · Lớp mẫu",centerDisplayName:"Center QA",
    status:"CLOSED" as const,interest:4,notes:"Giữ nhịp đều ở đoạn chuyển hợp âm.",
    difficulty:"Đoạn chuyển hợp âm",registeredAt:"2026-11-20T11:00:00.000Z",registeredByUserId:"qa-teacher",
    registeredByDisplayName:"Giáo viên mẫu",draftSavedAt:"2026-11-20T11:20:00.000Z",
    draftSavedByUserId:"qa-teacher",closedAt:"2026-11-20T11:25:00.000Z",closedByUserId:"qa-teacher",
    updatedAt:"2026-11-20T11:25:00.000Z",draftSavedVersion:2,version:3,missionLinks:[link]};
  return {row:rowFromDiary(diary,studentName),links:[link]};
}

/** PAP-2221 · BO Student Detail — Diary table with separate Diary and Mission raw drawers. */
export function BoStudentDiaryRelation({
  studentId,studentName,centerId,centerReady,reviewOnly=false,onFullDetail,
}:{
  studentId:string;studentName:string;centerId:string;centerReady:boolean;
  reviewOnly?:boolean;onFullDetail?:(record:BoRecord)=>void;
}){
  const [records,setRecords]=useState<readonly StudentPathDiary[]>([]);
  const [loadState,setLoadState]=useState("loading");
  const [diaryDrawer,setDiaryDrawer]=useState<BoRecord|null>(null);
  const [missionDrawer,setMissionDrawer]=useState<BoRecord|null>(null);
  const [missionChoices,setMissionChoices]=useState<readonly StudentPathDiaryMissionLink[]|null>(null);
  const [missionLoading,setMissionLoading]=useState(false);
  const [missionError,setMissionError]=useState("");
  const [table,setTable]=useState<BoTableState>(()=>defaultTable(diaryTableModule.fields));
  const [page,setPage]=useState(1);

  useEffect(()=>{
    if(reviewOnly){setLoadState("ready");setRecords([]);return;}
    if(!centerReady||!centerId||!studentId){setLoadState("Chọn Center để xem Diary.");setRecords([]);return;}
    const controller=new AbortController();
    setLoadState("loading");setRecords([]);
    void readStudentPathDiaries(fetch,centerId,studentId,controller.signal).then(value=>{
      if(controller.signal.aborted)return;
      setRecords(value);setLoadState("ready");
    }).catch(error=>{
      if(controller.signal.aborted)return;
      setLoadState(error instanceof Error?error.message:"Không thể đọc Diary.");
    });
    return ()=>controller.abort();
  },[centerId,centerReady,reviewOnly,studentId]);

  const fixture=useMemo(()=>reviewRow(studentName),[studentName]);
  const relations:RelationByDiary=useMemo(()=>reviewOnly
    ?new Map([[fixture.row.id,fixture.links] as const])
    :new Map(records.map(record=>[record.id,record.missionLinks] as const)),[fixture,records,reviewOnly]);
  const rows=useMemo(()=>reviewOnly?[fixture.row]:records.map(record=>rowFromDiary(record,studentName)),[fixture,records,reviewOnly,studentName]);
  const update=(patch:Partial<BoTableState>)=>{setTable(current=>({...current,...patch}));setPage(1);};

  async function openMission(link:StudentPathDiaryMissionLink){
    setMissionError("");setMissionLoading(true);
    try{
      const record=reviewOnly?reviewMissionRecord(link,link.diaryId):await readMission(fetch,centerId,link.missionId);
      setDiaryDrawer(null);setMissionChoices(null);
      setMissionDrawer({...record,diaryRecordId:link.diaryId});
    }catch(error){
      setMissionError(error instanceof Error?error.message:"Không thể đọc Nhiệm vụ.");
    }finally{setMissionLoading(false);}
  }
  const openRelation=(record:BoRecord)=>{
    const links=relations.get(record.id)??[];
    if(!links.length)return;
    if(links.length===1){void openMission(links[0]!);return;}
    setDiaryDrawer(null);setMissionDrawer(null);setMissionError("");
    setMissionChoices(links);
  };

  return <>
    <div>
      {reviewOnly?<aside className="settings-hint" role="note">Bản ghi mẫu chỉ để duyệt giao diện; không đọc từ Core.</aside>:null}
      <BoDataTable
        module={diaryTableModule} showChrome={false} rows={rows} loadState={loadState}
        value={table} update={update} page={page} setPage={setPage}
        onOpen={record=>{setMissionDrawer(null);setMissionChoices(null);setDiaryDrawer(record);}}
        onPrimaryCellOpen={openRelation}
        policy={diaryTablePolicy}
        selected={diaryDrawer?.id??(typeof missionDrawer?.diaryRecordId==="string"?missionDrawer.diaryRecordId:undefined)}
        onSettings={()=>{}} filterOpen={false} setFilterOpen={()=>{}} views={[]} changeViews={()=>{}}
        activeView={null} applyView={()=>{}} reset={()=>update(defaultTable(diaryTableModule.fields))}
        undo={()=>{}} canUndo={false} openEnabled
      />
      {missionError?<p className="edit-error" role="alert">{missionError}</p>:null}
      {!reviewOnly&&loadState==="ready"&&rows.length===0?<p className="settings-hint" role="status">Học viên chưa có Diary trong Center này.</p>:null}
    </div>
    {diaryDrawer?<BoQuickView
      module={diaryRawModule}record={diaryDrawer}onClose={()=>setDiaryDrawer(null)}
      hideDetailAction={!onFullDetail}
      onDetail={()=>{const record=diaryDrawer;setDiaryDrawer(null);onFullDetail?.(record);}}
    />:null}
    {missionDrawer?<BoQuickView
      module={missionRawModule}record={missionDrawer}onClose={()=>setMissionDrawer(null)}
      hideDetailAction
    />:null}
    {missionChoices?<DrawerFrame
      title="Nhiệm vụ liên kết"path="Diary / Nhiệm vụ"onClose={()=>setMissionChoices(null)}
      footer={<button type="button" className="secondary-btn" onClick={()=>setMissionChoices(null)}>Đóng</button>}
    >
      <p className="settings-hint">Chọn một Nhiệm vụ để mở bản ghi raw.</p>
      <div className="option-list">
        {missionChoices.map(link=><button key={link.id} type="button" className="secondary-btn"
          disabled={missionLoading} onClick={()=>void openMission(link)}>
          {link.missionCode} — {link.missionName}
        </button>)}
      </div>
      {missionLoading?<p role="status">Đang tải Nhiệm vụ…</p>:null}
      {missionError?<p className="edit-error" role="alert">{missionError}</p>:null}
    </DrawerFrame>:null}
  </>;
}
