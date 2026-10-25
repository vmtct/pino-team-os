/* Data/metadata only. Field widths/types are existing registration archetypes. */
(function(root){
 'use strict';
 const ID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
 const id=v=>{if(typeof v!=='string'||!ID.test(v))throw Error('Core trả về ID không hợp lệ.');return v;};
 const text=v=>{if(typeof v!=='string')throw Error('Phản hồi Core không hợp lệ.');return v;};
 const fields=items=>items.map(([key,label,type='text'])=>({key,label,type,readonly:true,icon:({id:'#',number:'#',select:'▣',boolean:'☑',date:'▦',relation:'↗'})[type]||'Aa',w:({name:235,id:145})[key]||({number:113,select:135,boolean:120,date:145,relation:172})[type]||172}));
 const modules={
  students:{label:'Students',fields:fields([['name','Học viên'],['id','ID','id'],['paths','Path'],['birthYear','Năm sinh','number'],['status','Trạng thái hồ sơ','select'],['houseMember','House Member','boolean']])},
  classes:{label:'Running Classes',fields:fields([['name','Running Class'],['id','ID','id'],['path','Path','relation'],['center','Cơ sở','relation'],['weekday','Thứ','number'],['window','Giờ học'],['capacity','Sức chứa','number'],['topology','Mô hình','select'],['status','Trạng thái','select']])},
  subscriptions:{label:'Subscriptions',fields:fields([['name','Học viên'],['id','Subscription ID','id'],['path','Path','relation'],['status','Trạng thái','select'],['weekly','Buổi / tuần','number'],['remaining','Buổi còn lại','number'],['start','Bắt đầu','date'],['end','Kết thúc','date'],['reference','Tham chiếu']])},
  enrollments:{label:'Enrollments',fields:fields([['name','Học viên'],['id','Enrollment ID','id'],['subscriptionId','Subscription ID','id'],['runningClass','Running Class','relation'],['runningClassId','Running Class ID','id'],['path','Path','relation'],['start','Hiệu lực từ','date'],['end','Kết thúc (loại trừ)','date'],['entry','Giờ vào dự kiến'],['duration','Phút dự kiến','number']])}
 };
 const unique=rows=>{const seen=new Set();for(const r of rows){id(r.id);if(seen.has(r.id))throw Error('Con trỏ không tiến hoặc ID trùng.');seen.add(r.id);}return rows;};
 async function load(key,fetcher){
  if(!Object.hasOwn(modules,key))throw Error('Module chưa được kết nối.');
  const read=async path=>{
   const r=await fetcher('/api/bo/'+path,{method:'GET',credentials:'same-origin',cache:'no-store',redirect:'error',signal:AbortSignal.timeout(20000)});
   if(!r.ok)throw Error(r.status===401?'Phiên đăng nhập đã hết hạn.':r.status===403?'Bạn không có quyền đọc dữ liệu này.':r.status===409?'Dữ liệu đã thay đổi. Hãy tải lại.':'Không thể tải dữ liệu. Hãy tải lại.');
   const b=await r.json();if(b.data===undefined)throw Error('Phản hồi Core không hợp lệ.');return b.data;
  };
  const paged=async(path,map)=>{
   const result=[],cursors=new Set();let cursor=null;
   for(let page=0;;page++){
    if(page>=100)throw Error('Danh sách quá lớn. Chưa tải dữ liệu.');
    const query=new URLSearchParams({limit:'100'});if(cursor){query.set('beforeCreatedAt',text(cursor.createdAt));query.set('beforeSubscriptionId',id(cursor.id));}
    const data=await read(path+'?'+query);if(!Array.isArray(data.items)||!Object.hasOwn(data,'nextCursor'))throw Error('Phân trang Core không hợp lệ.');
    result.push(...data.items.map(map));if(result.length>10000)throw Error('Danh sách quá lớn.');
    if(data.nextCursor===null)break;
    const next=JSON.stringify(data.nextCursor);if(cursors.has(next))throw Error('Con trỏ không tiến.');cursors.add(next);cursor=data.nextCursor;
   }
   return unique(result);
  };
  if(key==='students'){
   const result=[];let cursor=null;
   for(let page=0;;page++){
    if(page>=100)throw Error('Danh bạ quá lớn. Chưa tải dữ liệu.');
    const chunk=await read('learners?limit=100'+(cursor?'&beforeStudentId='+encodeURIComponent(cursor):''));if(!Array.isArray(chunk))throw Error('Phản hồi danh bạ không hợp lệ.');
    for(const s of chunk){if(!Array.isArray(s.activePaths))throw Error('Path không hợp lệ.');result.push({id:id(s.id),name:text(s.displayName),paths:s.activePaths.map(p=>text(p.displayName)).join(', '),birthYear:s.birthYear,status:text(s.status),houseMember:s.houseMember});}
    unique(result);if(chunk.length<100)break;const next=id(chunk.at(-1).id);if(cursor===next)throw Error('Con trỏ không tiến.');cursor=next;
   }
   return result;
  }
  if(key==='classes'){
   // Current admitted delivery read, no legacy /running-classes fallback.
   const b=await read('delivery/bootstrap-state');if(!Array.isArray(b.runningClasses)||!Array.isArray(b.paths)||!Array.isArray(b.centers))throw Error('Danh sách lớp không hợp lệ.');
   const paths=new Map(b.paths.map(p=>[id(p.id),text(p.displayName)])),centers=new Map(b.centers.map(c=>[id(c.id),text(c.displayName)]));
   return unique(b.runningClasses.map(c=>({id:id(c.id),name:text(c.operationalName),path:paths.get(id(c.pathProgramId))||c.pathProgramId,center:centers.get(id(c.centerId))||c.centerId,weekday:c.weekdayIso,window:text(c.windowStartsLocal)+' – '+text(c.windowEndsLocal),capacity:c.optimalConcurrentCapacity,topology:text(c.deliveryTopology),status:text(c.status)})));
  }
  if(key==='subscriptions')return paged('subscriptions',s=>({id:id(s.id),name:text(s.studentDisplayName),path:text(s.pathDisplayName),status:text(s.lifecycle),weekly:s.weeklyCommitment,remaining:s.effectiveAvailableUnits,start:s.serviceStartsOn,end:s.contractualEndsOn,reference:s.commercialReference}));
  return paged('school/enrollments',e=>({id:id(e.id),name:text(e.studentDisplayName),subscriptionId:id(e.subscriptionId),runningClass:text(e.runningClassName),runningClassId:id(e.runningClassId),path:text(e.pathDisplayName),start:e.effectiveFromLocalDate,end:e.effectiveUntilExclusiveLocalDate,entry:e.plannedEntryLocalTime,duration:e.plannedDurationMinutes}));
 }
 const api=Object.freeze({modules,load});root.PinoSchoolRead=api;if(typeof module==='object'&&module.exports)module.exports=api;
})(typeof globalThis==='object'?globalThis:this);
