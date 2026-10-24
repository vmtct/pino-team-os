/* PAP-979 subject-scoped read controller. No global audit fetch/filter fallback.
 * reader is a domain-owned paginated read contract, not a browser ACL.
 * Runtime deliberately has no reader until Core subject audit is admitted. */
(function(root){
"use strict";
function create(reader){
 let generation=0,subject=null,state={phase:"idle",events:[],nextCursor:null,error:null},lastQuery="";
 const snapshot=()=>structuredClone(state);
 const clear=()=>{generation++;subject=null;lastQuery="";state={phase:"idle",events:[],nextCursor:null,error:null};};
 function select(type,id){clear();subject={subject_type:type,subject_id:id};}
 async function load(query="",append=false){
  if(!subject)return;
  const ticket=++generation,requested={...subject},q=String(query).trim();
  const cursor=append&&q===lastQuery?state.nextCursor:null;
  const previous=append&&cursor?state.events:[];lastQuery=q;
  state={phase:"loading",events:[],nextCursor:null,error:null};
  try{
   if(q.length>120)throw Error("Tìm kiếm tối đa 120 ký tự.");
   if(!reader)throw Error("Lịch sử chưa khả dụng.");
   const page=await reader({...requested,query:q,cursor,limit:50});
   if(ticket!==generation)return;
   if(!page||!Array.isArray(page.events)||page.events.length>50||!(page.nextCursor===null||(typeof page.nextCursor==="string"&&page.nextCursor.length>0&&page.nextCursor.length<=2048)))throw Error("Phản hồi lịch sử không hợp lệ.");
   if(cursor&&page.nextCursor===cursor)throw Error("Con trỏ lịch sử không tiến.");
   const seen=new Set(previous.map(e=>e.id));let time=previous.at(-1)?.occurred_at,lastId=previous.at(-1)?.id;
   for(const event of page.events){
    // Reject the whole response rather than silently filtering unauthorized rows.
    if(event.subject_type!==requested.subject_type||event.subject_id!==requested.subject_id||typeof event.id!=="string"||seen.has(event.id)||!Number.isFinite(Date.parse(event.occurred_at)))throw Error("Không xác nhận được phạm vi lịch sử.");
    if(time&&Date.parse(event.occurred_at)>Date.parse(time))throw Error("Thứ tự lịch sử không hợp lệ.");
    if(time&&event.occurred_at===time&&event.id>=lastId)throw Error("Thứ tự lịch sử không hợp lệ.");
    seen.add(event.id);time=event.occurred_at;lastId=event.id;
   }
   state={phase:"ready",events:[...previous,...page.events],nextCursor:page.nextCursor,error:null};
  }catch(error){
   if(ticket!==generation)return;
   state={phase:"error",events:[],nextCursor:null,error:error.status===403?"Bạn không có quyền xem lịch sử.":error.status===409?"Lịch sử đã thay đổi. Hãy tải lại.":reader?"Không thể tải lịch sử. Hãy thử lại.":error.message};
  }
 }
 return {select,clear,load,snapshot};
}
root.PinoBOHistory={create};
if(typeof module==="object"&&module.exports)module.exports={create};
})(globalThis);
