const base=process.env.PINORIA_STAGING_URL??'https://pino-team-os-staging.minhtri-van42.workers.dev';
const centerId=process.env.PINORIA_CENTER_ID??'019d1000-0001-7000-8000-000000000001';
const studentProfileId=process.env.PINORIA_STUDENT_PROFILE_ID??'019d1000-0002-7000-8000-000000000002';
const companionId=process.env.PINORIA_COMPANION_ID??'01a04ff6-f715-7d4c-8710-2403b60f8a51';
const mode=process.argv[2]??'companion-verify';

async function call(path,init){
  const response=await fetch(`${base}${path}`,init);
  const body=await response.json().catch(()=>null);
  if(!response.ok)throw new Error(`${response.status} ${path} ${JSON.stringify(body)}`);
  return body;
}
function get(path){return call(path,{cache:'no-store'});}
function post(path,body,key){return call(path,{method:'POST',headers:{'content-type':'application/json',...(key?{'idempotency-key':key}:{})},body:JSON.stringify(body)});}
function assert(condition,message){if(!condition)throw new Error(message);}
function same(a,b,label){assert(JSON.stringify(a)===JSON.stringify(b),`${label} replay mismatch`);}
function qs(values){return new URLSearchParams(values).toString();}

async function readiness(){
  return (await get(`/api/tos-learning/pinoria/companion/readiness?${qs({centerId,studentProfileId})}`)).data;
}
async function available(){
  return (await get(`/api/tos-learning/pinoria/activities/available?${qs({centerId,studentProfileId})}`)).data;
}
async function history(limit=20){
  return (await get(`/api/tos-learning/pinoria/wish/history?${qs({centerId,studentProfileId,limit:String(limit)})}`)).data;
}
function companionOf(state){return state.companions.find(item=>item.companionId===companionId);}
function activityOf(items,handler){return items.find(item=>item.handlerKey===handler);}
async function companionVerify(){
  const state=await readiness();
  const companion=companionOf(state);
  assert(companion,'Companion missing from readiness');
  assert(companion.materializationLevel>=2,`Expected Mori >= Lv2, got ${companion.materializationLevel}`);
  const claim=await post('/api/pinoria-tv/presentation',{op:'claim',centerId});
  assert(claim.presentation===null,'TV queue is not empty after closed Companion proof');
  return{pass:true,mode,fruitBalance:state.fruitBalance,waterSigil:state.waterSigil,companion,tvQueue:'EMPTY'};
}

function mutationGate(expected){
  assert(process.env.PINORIA_MUTATION_CONFIRM===expected,`Mutation mode requires PINORIA_MUTATION_CONFIRM=${expected}`);
}
async function replayPost(path,body,key){
  const first=await post(path,body,key);
  const replay=await post(path,body,key);
  same(first,replay,path);
  return first;
}
async function companionAdvance(){
  mutationGate('STAGING_COMPANION_ADVANCE');
  const diary1=process.env.PINORIA_DIARY_ID_1,diary2=process.env.PINORIA_DIARY_ID_2;
  assert(diary1&&diary2,'PINORIA_DIARY_ID_1 and PINORIA_DIARY_ID_2 are required');
  const pre=await readiness(),preCompanion=companionOf(pre);
  assert(pre.fruitBalance===0,'Companion advance expects Fruit balance 0');
  assert(preCompanion?.materializationLevel===1&&preCompanion.stageFeedCount===0,'Companion advance expects fresh Lv1/feed0');
  const run=Date.now();
  const fruitBody=id=>({centerId,studentProfileId,classroomDiaryId:id});
  await replayPost('/api/tos-learning/pinoria/rewards/fruit/grant',fruitBody(diary1),`pinoria-synth-${run}-fruit-1`);
  await replayPost('/api/tos-learning/pinoria/rewards/fruit/grant',fruitBody(diary2),`pinoria-synth-${run}-fruit-2`);
  let state=await readiness();
  assert(state.fruitBalance===2,`Expected Fruit 2, got ${state.fruitBalance}`);
  const feedBody={centerId,studentProfileId,companionId};
  await replayPost('/api/tos-learning/pinoria/companions/feed',feedBody,`pinoria-synth-${run}-feed-1`);
  const feed2=await replayPost('/api/tos-learning/pinoria/companions/feed',feedBody,`pinoria-synth-${run}-feed-2`);
  assert(feed2.data.state==='READY_FOR_RITUAL'&&feed2.data.readinessRuleKey==='FEED_2','Feed #2 did not reach FEED_2 ritual readiness');
  const activities=await available(),ritual=activityOf(activities,'COMPANION_RITUAL');
  assert(ritual?.eligible,'Companion ritual is not eligible after feed #2');
  const action=ritual.actions.find(item=>item.key==='ADVANCE_COMPANION_MATERIALIZATION');
  assert(action?.enabled,'Companion ritual action is disabled');
  const ritualBody={centerId,studentProfileId,activityId:ritual.activityId,actionKey:'ADVANCE_COMPANION_MATERIALIZATION'};
  const ritualRun=await replayPost('/api/tos-learning/pinoria/activities/execute',ritualBody,`pinoria-synth-${run}-ritual`);
  assert(ritualRun.data.fromLevel===1&&ritualRun.data.toLevel===2,'Ritual did not advance Lv1 -> Lv2');
  state=await readiness();
  const postCompanion=companionOf(state);
  assert(postCompanion?.materializationLevel===2&&postCompanion.state==='GROWING'&&postCompanion.stageFeedCount===0,'Post ritual Companion state mismatch');
  const claim1=await post('/api/pinoria-tv/presentation',{op:'claim',centerId});
  assert(claim1.presentation?.id===ritualRun.data.presentationId&&claim1.presentation.kind==='COMPANION_RITUAL','TV did not claim ritual presentation');
  const claim2=await post('/api/pinoria-tv/presentation',{op:'claim',centerId});
  same(claim1,claim2,'TV claim');
  const done1=await post('/api/pinoria-tv/presentation',{op:'complete',centerId,presentationId:claim1.presentation.id});
  const done2=await post('/api/pinoria-tv/presentation',{op:'complete',centerId,presentationId:claim1.presentation.id});
  same(done1,done2,'TV complete');
  const empty=await post('/api/pinoria-tv/presentation',{op:'claim',centerId});
  assert(empty.presentation===null,'TV queue not empty after ritual complete');
  return{pass:true,mode,ritual:ritualRun.data,companion:postCompanion,tv:{presentationId:claim1.presentation.id,completedAt:done1.completedAt,queue:'EMPTY'}};
}
async function wishOne(){
  mutationGate('STAGING_WISH_DRAW_ONE');
  const activities=await available(),wish=activityOf(activities,'WISH_DRAW');
  assert(wish?.eligible,'Wish activity is not eligible');
  const draw=wish.actions.find(item=>item.key==='DRAW_ONE');
  assert(draw?.enabled,'DRAW_ONE is disabled');
  const pre=wish.context;
  assert(pre.energySeedBalance>=1,'Wish requires at least 1 Energy Seed');
  const expectedRule=process.env.PINORIA_EXPECTED_RULE_VERSION;
  const expectedHash=process.env.PINORIA_EXPECTED_DEFINITION_HASH;
  if(expectedRule)assert(pre.banner.rulesVersion===expectedRule,`Rules version drift: ${pre.banner.rulesVersion}`);
  if(expectedHash)assert(pre.banner.definitionHash===expectedHash,`Definition hash drift: ${pre.banner.definitionHash}`);
  const key=`pinoria-synth-${Date.now()}-wish-one`;
  const body={centerId,studentProfileId,activityId:wish.activityId,actionKey:'DRAW_ONE'};
  const result=await replayPost('/api/tos-learning/pinoria/activities/execute',body,key);
  assert(result.data.seedSpent===1,'DRAW_ONE did not spend exactly one Seed');
  const postWish=activityOf(await available(),'WISH_DRAW');
  assert(postWish.context.energySeedBalance===pre.energySeedBalance-1,'Energy Seed balance did not decrement exactly once');
  const entries=await history(20),entry=entries.find(item=>item.drawId===result.data.drawId);
  assert(entry,'Wish draw missing from canonical history');
  assert(entry.pullCount===1&&entry.pulls.length===1,'Wish history pull count mismatch');
  const pull=entry.pulls[0];
  if(pre.pity.nextRarePityPosition>=pre.pity.rareGuaranteedWithin)assert(pull.rarity!=='COMMON','Rare hard pity produced COMMON');
  const claim1=await post('/api/pinoria-tv/presentation',{op:'claim',centerId});
  assert(claim1.presentation?.kind==='WISH_REVEAL','TV did not claim WISH_REVEAL');
  const claim2=await post('/api/pinoria-tv/presentation',{op:'claim',centerId});
  same(claim1,claim2,'Wish TV claim');
  const done1=await post('/api/pinoria-tv/presentation',{op:'complete',centerId,presentationId:claim1.presentation.id});
  const done2=await post('/api/pinoria-tv/presentation',{op:'complete',centerId,presentationId:claim1.presentation.id});
  same(done1,done2,'Wish TV complete');
  const empty=await post('/api/pinoria-tv/presentation',{op:'claim',centerId});
  assert(empty.presentation===null,'Wish TV queue not empty after complete');
  return{pass:true,mode,draw:result.data,history:{drawId:entry.drawId,rarity:pull.rarity,featured:pull.featured,perfectMemory:pull.perfectMemory},seed:{before:pre.energySeedBalance,after:postWish.context.energySeedBalance},pity:{before:pre.pity,after:postWish.context.pity},tv:{presentationId:claim1.presentation.id,completedAt:done1.completedAt,queue:'EMPTY'}};
}

let output;
if(mode==='companion-verify')output=await companionVerify();
else if(mode==='companion-advance')output=await companionAdvance();
else if(mode==='wish-one')output=await wishOne();
else throw new Error(`Unknown mode ${mode}`);
console.log(JSON.stringify(output,null,2));
