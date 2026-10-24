const {test}=require('node:test');const assert=require('node:assert/strict');
const {create}=require('./bo-core-pilot-adapter.js');
const id='019a1234-5678-7000-8000-123456789abc';
const student={id,displayName:'An',status:'ACTIVE',activePaths:[],version:3};
const context={surface:'BO',entitled:true,permissionKeys:['student.profile.view','student.profile.manage','delivery.schedule.view','delivery.schedule.manage']};
function fixture(routes){const calls=[];return {calls,fetch:async(url,options)=>{calls.push({url,options});const v=await routes(url,options);return Response.json(v.body??{data:v.data},{status:v.status??200});}};}
test('Core 401/403, invalid context and repeated directory cursor never fall back to synthetic data',async()=>{
 for(const status of [401,403])await assert.rejects(create('students',async()=>Response.json({error:{}},{status})));
 await assert.rejects(create('students',async()=>Response.json({data:{...context,entitled:false}})));
 const f=fixture(url=>url.endsWith('context')?{data:context}:{data:Array(100).fill(student)});
 await assert.rejects(create('students',f.fetch),/Con trỏ/);
});
test('student update preserves lifecycle, expected version and requires canonical readback before visible change',async()=>{
 let patched=false;const f=fixture((url,o)=>{
  if(url.endsWith('context'))return {data:context};if(url.includes('learners?'))return {data:[student]};
  if(o.method==='PATCH'){assert.deepEqual(JSON.parse(o.body),{displayName:'Bình',status:'ACTIVE',expectedVersion:3});patched=true;return {data:{...student,displayName:'Bình',version:4}};}
  return {data:{student:{...student,displayName:patched?'Bình':'An',version:patched?4:3}}};
 });const a=await create('students',f.fetch);const row=a.rows[0];const confirmed=await a.commit(row,'name','Bình');assert.equal(row.name,'An');assert.equal(confirmed.name,'Bình');assert.equal(f.calls.at(-1).options.method,'GET');
 assert.ok(f.calls.every(c=>c.url.startsWith('/api/bo/')&&c.options.credentials==='same-origin'));
});
test('version conflict and failed post-write readback do not mutate displayed rows or auto-retry',async()=>{
 for(const failure of ['conflict','readback']){let patches=0;const f=fixture((url,o)=>{
  if(url.endsWith('context'))return {data:context};if(url.includes('learners?'))return {data:[student]};
  if(o.method==='PATCH'){patches++;return failure==='conflict'?{status:409,body:{error:{}}}:{data:{}};}
  if(patches)return {status:503,body:{error:{message:'unavailable'}}};return {data:{student}};
 });const a=await create('students',f.fetch);await assert.rejects(a.commit(a.rows[0],'name','Bình'));assert.equal(a.rows[0].name,'An');assert.equal(patches,1);}
});
test('Staff without manage permission cannot create writes even if the UI calls commit directly',async()=>{
 const f=fixture(url=>url.endsWith('context')?{data:{...context,permissionKeys:['student.profile.view']}}:{data:[student]});const a=await create('students',f.fetch);
 assert.equal(a.fields.find(f=>f.key==='name').readonly,true);await assert.rejects(a.commit(a.rows[0],'name','No'),/chỉ đọc/);assert.equal(f.calls.some(c=>c.options.method!=='GET'),false);
});
test('class update retains complete canonical configuration/version and enforces capacity bounds',async()=>{
 let record={id,centerId:id,pathProgramId:id,learningSpaceId:id,operationalName:'Art',weekdayIso:1,windowStartsLocal:'18:00',windowEndsLocal:'19:00',deliveryTopology:'FIXED_COHORT',defaultParticipationMinutes:60,optimalConcurrentCapacity:8,hardConcurrentCapacity:12,status:'ACTIVE',version:2};
 const f=fixture((url,o)=>{if(url.endsWith('context'))return {data:context};if(o.method==='PATCH'){const b=JSON.parse(o.body);assert.equal(b.expectedVersion,2);assert.equal(b.learningSpaceId,id);assert.equal(b.windowStartsLocal,'18:00');record={...record,optimalConcurrentCapacity:b.optimalConcurrentCapacity,version:3};return {data:record};}return {data:{runningClasses:[record]}};});
 const a=await create('classes',f.fetch);await assert.rejects(a.commit(a.rows[0],'capacity',13),/giới hạn/);assert.equal(f.calls.some(c=>c.options.method==='PATCH'),false);
 const updated=await a.commit(a.rows[0],'capacity',10);assert.equal(updated.capacity,10);assert.equal(a.rows[0].capacity,8);
});
test('shared-view contract uses canonical fields and never substitutes profile lifecycle for learning',async()=>{
 const f=fixture(url=>url.endsWith('context')?{data:context}:{data:[{...student,activeSubscriptions:0,houseMember:true,birthYear:2018}]});
 const a=await create('students',f.fetch);assert.equal(a.rows[0].status,'ACTIVE');assert.equal(a.rows[0].learning,'inactive');assert.equal(a.rows[0].member,true);
 const cfg={search:'An',sort:'birth',desc:false,rules:[],logic:'AND',groupField:null,hideEmpty:true,order:a.fields.map(f=>f.key),visible:a.fields.map(f=>f.key)};
 const canonical=a.viewToCore(cfg);assert.deepEqual(canonical.columns.order,['name','id','paths','birth','learning','member','attention']);assert.equal(canonical.columns.order.includes('age'),false);
 assert.deepEqual(a.viewFromCore(canonical),{...cfg,view:'all',hiddenGroups:[]});
 assert.throws(()=>a.viewToCore({...cfg,order:['salary']}),/field/);
});
