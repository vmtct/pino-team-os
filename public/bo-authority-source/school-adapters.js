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
 const definitions={
  visits:['Student Visit','SCHOOL',[['name','Học viên'],['id','Visit ID','id'],['center','Cơ sở','relation'],['status','Trạng thái','select'],['checkIn','Check-in (UTC)','datetime'],['checkOut','Check-out (UTC)','datetime'],['duration','Thời lượng (giây)','number']]],
  staffs:['Staffs','WORKFORCE',[['name','Nhân sự'],['id','Staff ID','id'],['status','Trạng thái','select'],['department','Bộ phận'],['role','Vai trò']]],
  timekeeping:['Timekeeping','WORKFORCE',[['name','Nhân sự'],['id','Timekeeping ID','id'],['center','Cơ sở','relation'],['workDate','Ngày làm việc','date'],['status','Trạng thái','select'],['checkIn','Check-in gốc (UTC)','datetime'],['checkOut','Check-out gốc (UTC)','datetime'],['effectiveIn','Check-in hiệu lực (UTC)','datetime'],['effectiveOut','Check-out hiệu lực (UTC)','datetime'],['duration','Thời lượng hiệu lực (giây)','number']]],
  salaryPeriods:['Salary Period','WORKFORCE',[['name','Salary Period'],['id','Period ID','id'],['center','Cơ sở','relation'],['start','Bắt đầu','date'],['end','Kết thúc','date'],['status','Trạng thái','select'],['locked','Đã khóa ngày','boolean'],['version','Phiên bản','number']]],
  audits:['Audits','SYSTEM',[['name','Hành động'],['id','Audit ID','id'],['at','Thời điểm (UTC)','datetime'],['actorType','Loại tác nhân','select'],['actorId','Actor ID','id'],['subjectType','Loại đối tượng'],['subjectId','Subject ID','id'],['outcome','Kết quả','select'],['requestId','Request ID']]]
 };
 for(const [key,[label,group,items]] of Object.entries(definitions))modules[key]={label,group,fields:fields(items)};
 for(const key of ['students','classes','subscriptions','enrollments'])modules[key].group='SCHOOL';
 const unique=rows=>{if(rows.length>10000)throw Error('Danh sách quá lớn. Hãy giới hạn phạm vi.');const seen=new Set();for(const r of rows){id(r.id);if(seen.has(r.id))throw Error('Con trỏ không tiến hoặc ID trùng.');seen.add(r.id);}return rows;};
 function range(options={}){const to=options.to||new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Ho_Chi_Minh',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());const valid=v=>/^\d{4}-\d{2}-\d{2}$/.test(v)&&Number.isFinite(Date.parse(v+'T00:00:00Z'))&&new Date(v+'T00:00:00Z').toISOString().slice(0,10)===v;if(!valid(to))throw Error('Ngày kết thúc không hợp lệ.');const d=new Date(to+'T00:00:00Z');d.setUTCDate(d.getUTCDate()-30);const from=options.from||d.toISOString().slice(0,10);if(!valid(from)||from>to||Date.parse(to)-Date.parse(from)>30*86400000)throw Error('Khoảng ngày không hợp lệ (tối đa 31 ngày).');return{from,to};}
 function scopeLabel(key,options={}){const center=options.centerId?'Cơ sở đã chọn':'Các cơ sở được cấp quyền';if(key==='timekeeping'){const r=range(options);return center+' · '+r.from+' → '+r.to;}return ['visits','salaryPeriods'].includes(key)?center:'';}
 async function load(key,fetcher,options={}){
  if(!Object.hasOwn(modules,key))throw Error('Module chưa được kết nối.');
  const envelope=async path=>{
   const r=await fetcher('/api/bo/'+path,{method:'GET',credentials:'same-origin',cache:'no-store',redirect:'error',signal:AbortSignal.timeout(20000)});
   if(!r.ok)throw Error(r.status===401?'Phiên đăng nhập đã hết hạn.':r.status===403?'Bạn không có quyền đọc dữ liệu này.':r.status===409?'Dữ liệu đã thay đổi. Hãy tải lại.':'Không thể tải dữ liệu. Hãy tải lại.');
   const b=await r.json();if(b.data===undefined)throw Error('Phản hồi Core không hợp lệ.');return b;
  };
  const read=async path=>(await envelope(path)).data;
  const bound=(row,centerId)=>{if(row.centerId!==centerId)throw Error('Core trả về dữ liệu khác cơ sở.');return row;};
  const array=value=>{if(!Array.isArray(value))throw Error('Danh sách Core không hợp lệ.');return value;};
  const centers=async path=>{const list=array(await read(path));if(list.length>100)throw Error('Phạm vi cơ sở quá lớn.');if(options.centerId){id(options.centerId);const center=list.find(c=>c.id===options.centerId);if(!center)throw Error('Cơ sở không thuộc phạm vi đọc.');return[center];}return list;};
  const offsets=async(path,extract)=>{const result=[];let offset=0;for(let n=0;n<100;n++){const b=await envelope(path+(path.includes('?')?'&':'?')+'limit=100&offset='+offset),p=extract(b,offset);array(p.items);result.push(...p.items);if(result.length>10000)throw Error('Danh sách quá lớn. Hãy giới hạn phạm vi.');if(p.next===null)return result;if(!Number.isSafeInteger(p.next)||p.next<=offset)throw Error('Con trỏ không tiến.');offset=p.next;}throw Error('Danh sách quá lớn.');};
  if(key==='staffs')return unique(array(await read('workforce/staff-records')).map(s=>({id:id(s.id),name:text(s.displayLabel),status:text(s.status),department:s.department,role:s.roleLabel})));
  if(key==='audits'){const data=await offsets('access/audit',b=>{if(!b.page||!Number.isSafeInteger(b.page.offset)||typeof b.page.hasNext!=='boolean')throw Error('Phân trang audit không hợp lệ.');return{items:b.data,next:b.page.hasNext?b.page.offset+b.page.limit:null};});return unique(data.map(a=>({id:id(a.id),name:text(a.action),at:text(a.occurredAt),actorType:text(a.actorType),actorId:a.actorId,subjectType:text(a.subjectType),subjectId:a.subjectId,outcome:text(a.outcome),requestId:a.requestId})));}
  if(['visits','salaryPeriods','timekeeping'].includes(key)){
   const result=[],cs=await centers(key==='timekeeping'?'workforce/timekeeping/centers':'centers');
   for(const c of cs){const centerName=text(c.displayName||c.displayLabel),centerId=id(c.id);
    if(key==='visits'){const list=await offsets('student-visits?centerId='+centerId,(b,offset)=>({items:b.data.data,next:offset+b.data.data.length<b.data.total?offset+b.data.data.length:null}));result.push(...list.map(v=>({id:id(bound(v,centerId).id),name:text(v.student.displayName),center:text(v.center.displayName),status:text(v.status),checkIn:v.checkedInAt,checkOut:v.checkedOutAt,duration:v.durationSeconds})));}
    if(key==='salaryPeriods'){const list=await offsets('workforce/payroll/periods?centerId='+centerId,b=>({items:b.data.data,next:b.data.nextOffset}));result.push(...list.map(p=>({id:id(bound(p,centerId).id),name:text(p.name),center:centerName,start:p.startDate,end:p.endDate,status:text(p.status),locked:p.dateLocked,version:p.version})));}
    if(key==='timekeeping'){const r=range(options),seen=new Set();let cursor=null;for(let n=0;;n++){if(n>=100)throw Error('Danh sách quá lớn.');const b=await read('workforce/timekeeping?'+new URLSearchParams({centerId,startDate:r.from,endDate:r.to,limit:'100',...(cursor?{cursor}:{})}));result.push(...array(b.data).map(t=>({id:id(bound(t,centerId).id),name:text(t.staff.displayLabel),center:centerName,workDate:t.workDate,status:text(t.status),checkIn:t.recorded.checkInAt,checkOut:t.recorded.checkOutAt,effectiveIn:t.effective.checkInAt,effectiveOut:t.effective.checkOutAt,duration:t.effective.durationSeconds})));if(b.nextCursor===null)break;const next=text(b.nextCursor);if(seen.has(next))throw Error('Con trỏ không tiến.');seen.add(next);cursor=next;}}
    unique(result);}return unique(result);
  }
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
 const api=Object.freeze({modules,load,scopeLabel});root.PinoSchoolRead=api;if(typeof module==='object'&&module.exports)module.exports=api;
})(typeof globalThis==='object'?globalThis:this);
