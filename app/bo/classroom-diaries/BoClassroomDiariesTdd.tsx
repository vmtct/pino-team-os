"use client";
import "@pino/design-system/bo-tokens.css";
import "@pino/design-system/components.css";
import {useEffect,useMemo,useState} from "react";
import readApi from "@/public/bo-authority-source/school-adapters.js";
import {BoRegistrationWorkspace,type BoWorkspaceSource} from "@/app/bo/components/registration/BoRegistrationWorkspace";
import {useBoCenterSelection} from "@/app/bo/components/registration/BoCenterSelection";
import type {DirectoryCenterSource} from "@/app/bo/pinoria-avatars/centers";
import {createBoTddAdapter,type AuthenticatedSurfaceAdapter} from "@/lib/workspace-adapters";
import {SurfaceWorkspace} from "@/app/components/workspace-adapters/SurfaceWorkspace";
import {browserTddNavigation,type AdapterNavigation} from "@/lib/workspace-adapters/navigation";
import {TddRegistry} from "@/lib/workspace-schema";
import {diaryDefinition,diaryFields,diaryProvider,diaryQueryForDay,localDayToday,validDiaryDay} from "./schema";

type F=typeof diaryFields;
type Ready={centerId:string;adapter:AuthenticatedSurfaceAdapter<F>;navigation:AdapterNavigation<F>};
const source:BoWorkspaceSource={
 ...readApi,
 modules:{...readApi.modules,"classroom-diaries":{
  label:"Nhật ký lớp học",group:"School",fields:[
   {key:"student",label:"Học viên",type:"text",icon:"Aa",w:225,readonly:true},
   {key:"mission",label:"Nhiệm vụ",type:"text",icon:"▣",w:240,readonly:true},
   {key:"date",label:"Ngày học",type:"text",icon:"⌁",w:140,readonly:true},
   {key:"className",label:"Lớp / bối cảnh",type:"text",icon:"▣",w:240,readonly:true},
   {key:"submitter",label:"Người Submit",type:"text",icon:"Aa",w:235,readonly:true},
   {key:"status",label:"Trạng thái",type:"text",icon:"◉",w:140,readonly:true},
   {key:"diaryCode",label:"Diary ID",type:"text",icon:"#",w:300,readonly:true},
  ],
 }},
};

/** PAP-1460 / Epic PAP-1316. One BO shell Active Center, diary date remains business-owned. */
export function BoClassroomDiariesTdd(){
 const center=useBoCenterSelection();
 const selected=(!center||center.loading||center.error)?"":center.selected;
 const sourceKind=center?.source??"centers";
 const [date,setDate]=useState(localDayToday);
 const validDate=validDiaryDay(date);
 const content=<section data-testid="bo-classroom-diaries-tdd" aria-label="Nhật ký lớp học tại Center">
  <div className="property-row">
   <label htmlFor="diary-day">Ngày học</label>
   <input id="diary-day" type="date" value={date} onChange={e=>setDate(e.target.value)}/>
  </div>
  {!center?<p role="alert">Không tìm thấy Center context của BO.</p>:
   center.loading?<p role="status">Đang xác thực cơ sở được cấp quyền…</p>:
   center.error?<p role="alert">{center.error}</p>:
   !selected?<p role="status">Chọn trung tâm tại góc trên trái để xem Nhật ký.</p>:
   !validDate?<p role="alert">Chọn ngày học hợp lệ để đọc Nhật ký.</p>:
   <ScopedDiary key={selected+":"+sourceKind+":"+date} selected={selected} centerSource={sourceKind} date={date}/>}
 </section>;
 return <BoRegistrationWorkspace source={source} moduleKey="classroom-diaries" currentUser={{displayName:null}} content={content}/>;
}

/** Remounting on Center/date change aborts old read/detail and disposes stale TDD. */
function ScopedDiary({selected,centerSource,date}:{selected:string;centerSource:DirectoryCenterSource;date:string}){
 const [ready,setReady]=useState<Ready|null>(null);
 const [error,setError]=useState("");
 const [retry,setRetry]=useState(0);
 const query=useMemo(()=>diaryQueryForDay(date),[date]);
 useEffect(()=>{
  const controller=new AbortController();let adapter:AuthenticatedSurfaceAdapter<F>|null=null;
  void createBoTddAdapter({registry:new TddRegistry(),definition:diaryDefinition,provider:diaryProvider,
   centerId:selected,centerSource},controller.signal).then(bound=>{
   adapter=bound;
   if(controller.signal.aborted){bound.dispose();return;}
   setReady({centerId:selected,adapter:bound,navigation:browserTddNavigation("BO","classroom-diaries",query)});
  }).catch(e=>{
   if(!controller.signal.aborted)setError(e instanceof Error?e.message:"Không đủ quyền đọc Diary tại Center.");
  });
  return ()=>{controller.abort();adapter?.dispose();};
 },[selected,centerSource,query,retry]);
 if(error)return <p role="alert">{error} <button type="button" onClick={()=>{setReady(null);setError("");setRetry(n=>n+1)}}>Thử lại</button></p>;
 if(ready?.centerId!==selected)return <p role="status">Đang xác minh quyền Center và tải Nhật ký…</p>;
 return <>
  <SurfaceWorkspace key={selected+":"+date} adapter={ready.adapter} navigation={ready.navigation} initialQuery={query}/>
  <p role="note">Dữ liệu chỉ đọc từ Core tại Center và ngày đã chọn. Người Submit và Học viên hiện dùng ID xác thực; chưa có projection tên hiển thị.
   Liên kết Nhiệm vụ và xác nhận hoàn tất chỉ hiển thị khi API nguồn được triển khai; không suy diễn từ Diary.</p>
 </>;
}
