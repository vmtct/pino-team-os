/* PAP-891/893: explicit Core mode. Same-origin authenticated BFF only; no mock fallback. */
(function(root) {
 'use strict';
 const ID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
 const field=(key,label,type='text',readonly=true,w=145)=>({key,label,type,readonly,w,icon:({number:'#',id:'#',relation:'↗',person:'♙',select:'▣'})[type]||'Aa'});
 async function create(key,fetcher) {
  if(!['students','classes'].includes(key))throw new Error('Unsupported Core pilot');
  const request=async(path,method='GET',body)=>{
   const response=await fetcher('/api/bo/'+path,{method,credentials:'same-origin',cache:'no-store',redirect:'error',headers:body?{'content-type':'application/json','idempotency-key':crypto.randomUUID()}:undefined,...(body?{body:JSON.stringify(body)}:{})});
   let payload;try{payload=await response.json();}catch{throw new Error('Không thể đọc phản hồi Core. Hãy đăng nhập hoặc tải lại.');}
   if(!response.ok||payload.data===undefined){const e=new Error(response.status===403?'Bạn không có quyền thực hiện thao tác này.':response.status===409?'Bản ghi đã thay đổi. Hãy tải lại trước khi sửa.':response.status===401?'Phiên đăng nhập đã hết hạn.':payload.error?.message||'Không thể tải dữ liệu Core.');e.status=response.status;throw e;}
   return payload.data;
  };
  const context=await request('context');
  if(context.surface!=='BO'||context.entitled!==true||!Array.isArray(context.permissionKeys))throw new Error('Không có quyền Back Office.');
  const readPermission=key==='students'?'student.profile.view':'delivery.schedule.view';
  if(!context.permissionKeys.includes(readPermission))throw new Error('Không có quyền đọc module này.');
  const canManage=context.permissionKeys.includes(key==='students'?'student.profile.manage':'delivery.schedule.manage');
  const originals=new Map(),pending=new Set();
  const assertId=id=>{if(typeof id!=='string'||!ID.test(id))throw new Error('Core trả về ID không hợp lệ.');return id;};
  const studentRow=s=>{assertId(s.id);return {id:s.id,name:s.displayName,status:s.status,program:(s.activePaths||[]).map(p=>p.displayName).join(', '),paths:(s.activePaths||[]).map(p=>p.displayName).join(', '),birth:s.birthYear==null?'':String(s.birthYear),learning:s.activeSubscriptions>0?'active':'inactive',member:s.houseMember===true,attention:null,age:null,sessions:null,approved:false};};
  const classRow=s=>{assertId(s.id);originals.set(s.id,structuredClone(s));return {id:s.id,name:s.operationalName??s.name,status:s.status,program:s.pathProgramId,schedule:s.weekdayIso?`${s.weekdayIso} · ${s.windowStartsLocal}–${s.windowEndsLocal}`:s.recurrenceWeekdays?.join(', ')+' · '+s.startLocalTime+'–'+s.endLocalTime,capacity:s.optimalConcurrentCapacity??s.defaultCapacity,teacher:null,approved:false};};
  let rows;
  if(key==='students'){
   rows=[];let cursor=null;const seen=new Set();
   for(let page=0;;page++){
    if(page>=1000)throw new Error('Danh bạ quá lớn; cần truy vấn có phân trang.');
    const chunk=await request('learners?limit=100'+(cursor?'&beforeStudentId='+encodeURIComponent(cursor):''));
    if(!Array.isArray(chunk))throw new Error('Core trả về danh bạ không hợp lệ.');
    for(const s of chunk){if(seen.has(s.id))throw new Error('Con trỏ danh bạ không tiến.');seen.add(s.id);rows.push(studentRow(s));}
    if(chunk.length<100)break;
    const next=assertId(chunk.at(-1)?.id);if(next===cursor)throw new Error('Con trỏ danh bạ không tiến.');cursor=next;
   }
  }else{
   const data=canManage?await request('delivery/bootstrap-state'):await request('running-classes');
   const list=canManage?data.runningClasses:data;
   if(!Array.isArray(list))throw new Error('Core trả về danh sách lớp không hợp lệ.');
   rows=list.map(classRow);
  }
  const fields=key==='students'?[field('name','Học viên','text',!canManage,235),field('id','ID','id'),field('status','Trạng thái','select'),field('program','Path','relation',true,172),field('age','Tuổi','number'),field('sessions','Buổi còn lại','number')]:[field('name','Running Class','text',!canManage,235),field('id','ID','id'),field('program','Chương trình','relation',true,172),field('schedule','Lịch','text',true,182),field('capacity','Sức chứa','number',!canManage,113),field('teacher','Giáo viên','person',true,162),field('status','Trạng thái','select')];
  // Core vocabulary is authoritative; never equate profile lifecycle with learning.
  if(key==='students')fields.splice(0,fields.length,field('name','Học viên','text',!canManage,235),field('id','ID','id'),field('paths','Path','text',true,172),field('birth','Năm sinh'),field('learning','Học tập','select'),field('member','House Member','boolean'),field('attention','Cần xử lý'));
  else fields.splice(5,1); // Teacher has no source in the class projection.
  const fieldMap=Object.fromEntries(fields.map(f=>[f.key,key==='classes'?(f.key==='name'?'class':f.key==='schedule'?'pattern':f.key):f.key]));
  const reverse=Object.fromEntries(Object.entries(fieldMap).map(([a,b])=>[b,a]));
  const mapField=(k,map)=>{if(k==null)return null;if(!Object.hasOwn(map,k))throw new Error('Shared View dùng field chưa được hỗ trợ.');return map[k];};
  const opOut={eq:'equals',neq:'is_not'},opIn=(op,k)=>fields.find(f=>f.key===k)?.type==='number'?(op==='equals'?'eq':op==='is_not'?'neq':op):op;
  const viewToCore=v=>({search:v.search,sort:v.sort?{field:mapField(v.sort,fieldMap),direction:v.desc?'desc':'asc'}:null,filters:v.rules.map(r=>({field:mapField(r.field,fieldMap),operator:opOut[r.op]||r.op,...(r.value===undefined?{}:{value:r.value}),...(r.second===undefined?{}:{end:r.second})})),logic:v.logic.toLowerCase(),groupBy:mapField(v.groupField,fieldMap),hideEmptyGroups:v.hideEmpty,columns:{order:v.order.map(k=>mapField(k,fieldMap)),visible:v.visible.map(k=>mapField(k,fieldMap))}});
  const viewFromCore=v=>({search:v.search,sort:v.sort?mapField(v.sort.field,reverse):null,desc:v.sort?.direction==='desc',rules:v.filters.map(r=>{const k=mapField(r.field,reverse);return {field:k,op:opIn(r.operator,k),value:r.value??'',second:r.end??''};}),logic:v.logic.toUpperCase(),view:'all',order:v.columns.order.map(k=>mapField(k,reverse)),visible:v.columns.visible.map(k=>mapField(k,reverse)),groupField:mapField(v.groupBy,reverse),hideEmpty:v.hideEmptyGroups,hiddenGroups:[]});
  const viewRole=context.permissionKeys.includes('bo.shared_view.manage')?'manager':'staff';
  const viewRuntime=root.PinoBOViews?.create(key,viewRole,Object.values(fieldMap));
  if(root.document&&!viewRuntime)throw new Error('Shared Views client không khả dụng.');
  if(viewRuntime)await viewRuntime.load(new URLSearchParams(root.location?.search||'').get('publicView'));
  return {actorName:context.displayName||context.email||"Người dùng",viewRuntime,viewRole,viewToCore,viewFromCore,key,label:key==='students'?'Học viên':'Classes',group:'SCHOOL',fields,rows,mode:'CORE',canManage,
   async commit(row,key,value){
    const id=assertId(row.id);
    if(!canManage||!(key==='name'||(key==='capacity'&&this.key==='classes')))throw new Error('Trường này chỉ đọc.');
    if(pending.has(id))throw new Error('Bản ghi đang được lưu.');
    if(key==='name'&&(!String(value).trim()||typeof value!=='string'))throw new Error('Tên không được trống.');
    if(key==='capacity'&&(!Number.isSafeInteger(Number(value))||Number(value)<1))throw new Error('Sức chứa phải là số nguyên dương.');
    pending.add(id);
    try{
     if(this.key==='students'){
      const snapshot=await request('students/'+id+'/lifecycle');const current=snapshot.student;
      if(current.id!==id||current.displayName!==row.name||current.status!==row.status||!Number.isSafeInteger(current.version))throw new Error('Bản ghi đã thay đổi. Hãy tải lại.');
      await request('students/'+id,'PATCH',{displayName:value.trim(),status:current.status,expectedVersion:current.version});
      const readback=await request('students/'+id+'/lifecycle');
      if(readback.student?.displayName!==value.trim()||readback.student?.id!==id)throw new Error('Không xác nhận được kết quả lưu. Hãy tải lại; không gửi lại tự động.');
      return studentRow(readback.student);
     }
     const source=originals.get(id);if(!source||!Number.isSafeInteger(source.version))throw new Error('Thiếu version của lớp. Hãy tải lại.');
     const {version,...body}=source;delete body.id;
     body[key==='name'?'operationalName':'optimalConcurrentCapacity']=key==='name'?value.trim():Number(value);
     if(body.hardConcurrentCapacity!==null&&body.optimalConcurrentCapacity>body.hardConcurrentCapacity)throw new Error('Sức chứa vượt giới hạn cứng.');
     await request('delivery/running-classes/'+id,'PATCH',{...body,expectedVersion:version});
     const readback=await request('delivery/bootstrap-state');const actual=readback.runningClasses?.find(s=>s.id===id);
     if(!actual||actual[key==='name'?'operationalName':'optimalConcurrentCapacity']!==body[key==='name'?'operationalName':'optimalConcurrentCapacity'])throw new Error('Không xác nhận được kết quả lưu. Hãy tải lại; không gửi lại tự động.');
     return classRow(actual);
    }finally{pending.delete(id);}
   }
  };
 }
 root.PinoBOCorePilot={create};if(typeof module==='object'&&module.exports)module.exports={create};
})(typeof globalThis==='object'?globalThis:this);
