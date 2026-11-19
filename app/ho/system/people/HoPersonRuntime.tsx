"use client";
/** PAP-2180: native Person UI backed solely by the canonical HO read client. */
import {useEffect,useState} from "react";
import {HoPersonDirectory,type PersonRow} from "./HoPersonDirectory";
import {createPersonReader,PersonReadError} from "./person-read-client";
import {loadPersonDirectory,personRow} from "./person-directory-loader";
type State={kind:"loading"|"ready"|"error"|"denied";rows:PersonRow[];counts?:{students:number;staff:number}};
const reader=createPersonReader();
const loadDetail=async(id:string,signal:AbortSignal)=>personRow(await reader.detail(id,signal));
export function HoPersonRuntime(){
 const [attempt,retry]=useState(0);
 const [state,setState]=useState<State>({kind:"loading",rows:[]});
 useEffect(()=>{
  const controller=new AbortController();

  void loadPersonDirectory(reader,controller.signal).then(result=>{
   if(!controller.signal.aborted)setState({kind:"ready",...result});
  }).catch((error:unknown)=>{
   if(!controller.signal.aborted)setState({kind:error instanceof PersonReadError&&[401,403].includes(error.status)?"denied":"error",rows:[]});
  });
  return ()=>controller.abort();
 },[attempt]);
 if(state.kind==="denied")return <p role="alert">Bạn không có quyền xem Person.</p>;
 return <HoPersonDirectory rows={state.rows} loadState={state.kind} onRetry={()=>{setState({kind:"loading",rows:[]});retry(n=>n+1);}} loadDetail={loadDetail} counts={state.counts}/>;
}
