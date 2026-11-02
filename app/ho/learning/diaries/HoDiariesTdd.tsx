"use client";
import "@pino/design-system/bo-tokens.css";
import "@pino/design-system/components.css";
import {useEffect,useMemo,useState} from "react";
import {boApi} from "@/lib/bo-api";
import type {BoCenter} from "@/lib/bo-model";
import {createHoTddAdapter,type AuthenticatedSurfaceAdapter} from "@/lib/workspace-adapters";
import {browserTddNavigation,type AdapterNavigation} from "@/lib/workspace-adapters/navigation";
import {TddRegistry} from "@/lib/workspace-schema";
import {SurfaceWorkspace} from "@/app/components/workspace-adapters/SurfaceWorkspace";
import {HoWorkspace} from "@/app/ho/HoWorkspace";
import {hoDiaryDefinition,hoDiaryFields,hoDiaryProvider,hoDiaryQueryForDay,localDayToday,validDiaryDay} from "./schema";

type F=typeof hoDiaryFields;
type Ready={adapter:AuthenticatedSurfaceAdapter<F>;navigation:AdapterNavigation<F>};
export function HoDiariesTdd(){
 const [center,setCenter]=useState("");
 const [day,setDay]=useState(localDayToday);
 const [centers,setCenters]=useState<readonly BoCenter[]>([]);
 const [error,setError]=useState("");
 const [retry,setRetry]=useState(0);
 const [ready,setReady]=useState<Ready|null>(null);
 const query=useMemo(()=>validDiaryDay(day)?hoDiaryQueryForDay(day,center):null,[day,center]);
 useEffect(()=>{
  let live=true;
  void boApi.centers().then(data=>{if(live)setCenters(data)}).catch(()=>{
   // A missing Center catalog never grants access or creates synthetic Center names.
  });
  return ()=>{live=false};
 },[]);
 useEffect(()=>{
  if(!query)return;
  const controller=new AbortController();let adapter:AuthenticatedSurfaceAdapter<F>|null=null;
  void createHoTddAdapter({registry:new TddRegistry(),definition:hoDiaryDefinition,
     provider:hoDiaryProvider},controller.signal)
    .then(result=>{
     adapter=result;if(controller.signal.aborted){result.dispose();return}
     setReady({adapter:result,navigation:browserTddNavigation("HO","classroomDiaries",query)});
    }).catch(e=>{if(!controller.signal.aborted)setError(e instanceof Error?e.message:"Không thể đọc Nhật ký GLOBAL.")});
  return ()=>{controller.abort();adapter?.dispose()};
 },[query,center,retry]);
 const content=<section data-testid="ho-classroom-diaries-tdd" aria-label="Nhật ký lớp học toàn hệ thống">
  <div className="property-row">
   <label htmlFor="ho-diary-center">Center</label>
   <select id="ho-diary-center" value={center} onChange={e=>{setCenter(e.target.value);setReady(null);setError("")}}>
    <option value="">Tất cả Center</option>
    {centers.map(c=><option key={c.id} value={c.id}>{c.displayName}</option>)}
   </select>
   <label htmlFor="ho-diary-day">Ngày học</label>
   <input id="ho-diary-day" type="date" value={day}
    onChange={e=>{setDay(e.target.value);setReady(null);setError("")}}/>
  </div>
  {!query?<p role="alert">Chọn ngày học hợp lệ.</p>:
   error?<p role="alert">{error} <button type="button" onClick={()=>{setError("");setReady(null);setRetry(n=>n+1)}}>Thử lại</button></p>:
   ready?<><SurfaceWorkspace key={center+":"+day} adapter={ready.adapter}
     navigation={ready.navigation} initialQuery={query}/>
    <p role="note">Nguồn Core GLOBAL chỉ đọc. Học viên, Người Submit và Center hiển thị ID nguồn khi chưa có phép chiếu tên.
     Nhiệm vụ và trạng thái hoàn tất chỉ có khi API độc lập xác nhận; không suy diễn.</p></>:
   <p role="status">Đang xác minh quyền HO và tải Nhật ký…</p>}
 </section>;
 return <HoWorkspace module="classroomDiaries" content={content}/>;
}
