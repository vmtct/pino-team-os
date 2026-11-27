import test from "node:test";
import assert from "node:assert/strict";
import { projectReceptionDay, readReceptionDay, receptionShiftActivity, type ReceptionDaySnapshot, type ReceptionDayVisit } from "./tos-reception-day-api";
const date="2026-11-27", center="c1", start="2026-11-26T17:00:00.000Z", end="2026-11-27T17:00:00.000Z";
const learner=(id:string)=>({studentProfileId:id,displayName:id,sessionIds:["s"],hasRosterConflict:false});
const visit=(id:string,studentProfileId:string,checkedInAt:string,checkedOutAt:string|null):ReceptionDayVisit=>({id,studentProfileId,displayName:studentProfileId,checkedInAt,checkedOutAt,version:1});
const snapshot=():ReceptionDaySnapshot=>({centerId:center,localDate:date,timeZone:"Asia/Ho_Chi_Minh",window:{startsAt:start,endsAt:end},dayVisitsComplete:true,
  sessions:[{id:"s",scheduledStartsLocal:"18:00",scheduledEndsLocal:"19:00",pathName:"Piano",className:"Class A",spaceName:"Room A",unresolvedRegistrations:[]}],
  learners:["expected","returned","left"].map(learner),
  dayVisits:[visit("a","left","2026-11-27T01:00:00.000Z","2026-11-27T02:00:00.000Z"),
    visit("b","returned","2026-11-27T01:00:00.000Z","2026-11-27T02:00:00.000Z"),
    visit("c","returned","2026-11-27T03:00:00.000Z",null),
    visit("d","carryover","2026-11-26T16:00:00.000Z",null),
    visit("e","walkin","2026-11-27T04:00:00.000Z","2026-11-27T05:00:00.000Z")]});
test("PAP-2431 projects actual visits, return, unscheduled and carryover separately from attendance",()=>{
  const result=projectReceptionDay(snapshot(),center,date);
  assert.equal(result.attendance.expected,"EXPECTED");
  assert.equal(result.attendance.left,"LEFT");
  assert.equal(result.attendance.returned,"ARRIVED");
  assert.equal(result.attendance.carryover,"ARRIVED");
  assert.equal(result.attendance.walkin,"LEFT");
  assert.equal(result.activeVisits.returned?.id,"c");
  assert.equal(result.guests.find(x=>x.id==="expected")?.className,"Class A");
  assert.equal(result.events[0]?.id,"e:departure");
  assert.equal(result.events.some(x=>x.id==="d:arrival"),false);
});
test("PAP-2431 refuses stale scope or incomplete history rather than fake zero",()=>{
  assert.throws(()=>projectReceptionDay(snapshot(),"wrong",date));
  assert.throws(()=>projectReceptionDay({...snapshot(),dayVisitsComplete:false},center,date));
  assert.throws(()=>projectReceptionDay({...snapshot(),dayVisits:undefined as never},center,date));
});
test("PAP-2431 refuses duplicate or ambiguous active visit evidence",()=>{
  const data=snapshot();
  data.dayVisits.push(visit("extra","returned","2026-11-27T04:00:00.000Z",null));
  assert.throws(()=>projectReceptionDay(data,center,date),/Conflicting active/);
});
test("PAP-2431 reads existing authenticated endpoint and preserves denial",async(t)=>{
  const calls:string[]=[];
  const spy=t.mock.method(globalThis,"fetch",async(url:string|URL|Request)=>{calls.push(String(url));return calls.length===1?Response.json({data:snapshot()}):Response.json({error:{message:"Denied"}},{status:403});});
  assert.equal((await readReceptionDay(center,date)).attendance.left,"LEFT");
  assert.equal(calls[0],"/api/tos-learning/arrival-desk?centerId=c1&localDate=2026-11-27");
  await assert.rejects(()=>readReceptionDay(center,date),/Denied/);
  spy.mock.restore();
});
test("PAP-2431 activity uses only actual Center-local shift windows",()=>{
 const day=projectReceptionDay(snapshot(),center,date);
 assert.equal(receptionShiftActivity(day,[]),null);
 assert.equal(receptionShiftActivity(day,[{startsLocal:"18:00",endsLocal:"02:00"}]),null);
 const events=receptionShiftActivity(day,[{startsLocal:"08:00",endsLocal:"10:00"}]);
 assert.deepEqual(events?.map(e=>e.id),["a:departure","b:departure","a:arrival","b:arrival"]);
});
