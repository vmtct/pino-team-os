"use client";
import "@pino/design-system/bo-tokens.css";
import "@pino/design-system/components.css";
import {useEffect,useMemo,useState} from "react";
import readApi from "@/public/bo-authority-source/school-adapters.js";
import {boApi} from "@/lib/bo-api";
import type {BoCenter} from "@/lib/bo-model";
import {BoRegistrationWorkspace,type BoWorkspaceSource} from "@/app/bo/components/registration/BoRegistrationWorkspace";
import {createBoTddAdapter,type AuthenticatedSurfaceAdapter} from "@/lib/workspace-adapters";
import {SurfaceWorkspace} from "@/app/components/workspace-adapters/SurfaceWorkspace";
import {browserTddNavigation,type AdapterNavigation} from "@/lib/workspace-adapters/navigation";
import {TddRegistry} from "@/lib/workspace-schema";
import {diaryDefinition,diaryFields,diaryProvider,diaryQueryForDay,localDayToday,validDiaryDay} from "./schema";

type F=typeof diaryFields;
type Ready={adapter:AuthenticatedSurfaceAdapter<F>;navigation:AdapterNavigation<F>};
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
const active=(c:BoCenter)=>/^[0-9a-f-]{36}$/i.test(c.id)&&c.status==="active";
export function BoClassroomDiariesTdd(){
 const [centers,setCenters]=useState<readonly BoCenter[]>([]);
 const [centerId,setCenterId]=useState("");
 const [date,setDate]=useState(localDayToday);
 const [centerError,setCenterError]=useState("");
 const [error,setError]=useState("");
 const [retry,setRetry]=useState(0);
 const [ready,setReady]=useState<Ready|null>(null);
 const query=useMemo(()=>validDiaryDay(date)?diaryQueryForDay(date):null,[date]);
 useEffect(()=>{
  let live=true;
  void boApi.centers().then(rows=>{
   if(!live)return;
   const allowed=rows.filter(active);
   setCenters(allowed);
   setCenterId(allowed.length===1?allowed[0]!.id:"");
   if(!allowed.length)setCenterError("Không có Center đang hoạt động được cấp quyền.");
  }).catch(()=>{if(live)setCenterError("Không thể tải Center từ Core.")});
  return ()=>{live=false};
 },[]);
 useEffect(()=>{
  if(!query||!centerId)return
  const controller=new AbortController();let adapter:AuthenticatedSurfaceAdapter<F>|null=null;
  void createBoTddAdapter({registry:new TddRegistry(),definition:diaryDefinition,provider:diaryProvider,centerId:centerId,centerSource:"centers"},controller.signal)
   .then(bound=>{
    adapter=bound;if(controller.signal.aborted){bound.dispose();return}
    setReady({adapter:bound,navigation:browserTddNavigation("BO","classroom-diaries",query)});
   }).catch(e=>{if(!controller.signal.aborted)setError(e instanceof Error?e.message:"Không đủ quyền đọc Diary tại Center.")});
  return ()=>{controller.abort();adapter?.dispose()};
 },[query,centerId,retry]);
 const scopeValid=Boolean(centerId&&query);
 const content=<section data-testid="bo-classroom-diaries-tdd" aria-label="Nhật ký lớp học tại Center">
  <div className="property-row">
   <label htmlFor="diary-center">Center</label>
   <select id="diary-center" value={centerId} onChange={e=>{setReady(null);setCenterId(e.target.value);setError("")}}>
    <option value="">Chọn Center</option>
    {centers.map(c=><option key={c.id} value={c.id}>{c.displayName}</option>)}
   </select>
   <label htmlFor="diary-day">Ngày học</label>
   <input id="diary-day" type="date" value={date} onChange={e=>{setReady(null);setError("");setDate(e.target.value)}}/>
  </div>
  {!scopeValid?<p role="status">{centerError||"Chọn Center và ngày học hợp lệ để đọc Nhật ký."}</p>:
   error?<p role="alert">{error} <button type="button" onClick={()=>{setError("");setRetry(n=>n+1)}}>Thử lại</button></p>:
   ready?<><SurfaceWorkspace key={centerId+":"+date} adapter={ready.adapter} navigation={ready.navigation} initialQuery={query!}/>
   <p role="note">Dữ liệu chỉ đọc từ Core tại Center và ngày đã chọn. Người Submit và Học viên hiện dùng ID xác thực; chưa có projection tên hiển thị.
    Liên kết Nhiệm vụ và xác nhận hoàn tất chỉ hiển thị khi API nguồn được triển khai; không suy diễn từ Diary.</p></>:
   <p role="status">Đang xác minh quyền Center và tải Nhật ký…</p>}
 </section>;
 return <BoRegistrationWorkspace source={source} moduleKey="classroom-diaries" currentUser={{displayName:null}} content={content}/>;
}
