export interface RosterCandidate {id:string;name:string;canAdd:boolean}
const base="/api/tos-learning/classroom/";
export async function searchClassroomStudents(centerId:string,runningClassId:string,query:string,limit:number,signal:AbortSignal){
 const items:RosterCandidate[]=[];
 let more=true;
 for(let offset=0;more&&offset<limit;offset+=50){
  const params=new URLSearchParams({centerId,runningClassId,query,offset:String(offset)});
  const response=await fetch(base+"roster-candidates?"+params,{signal,cache:"no-store"});
  const {data}=await response.json();
  if(!response.ok||data?.centerId!==centerId||data.runningClassId!==runningClassId||!Array.isArray(data.items))
   throw new Error("Invalid roster candidate response");
  items.push(...data.items);
  more=data.hasMore===true;
 }
 return {items,more};
}
export async function addClassroomStudent(centerId:string,runningClassId:string,localDate:string,studentProfileId:string){
 const response=await fetch(base+"roster-inclusions",{method:"POST",headers:{
  "content-type":"application/json","idempotency-key":["pap1930",runningClassId,localDate,studentProfileId].join(":"),
 },body:JSON.stringify({centerId,runningClassId,localDate,studentProfileId,reason:"Classroom manual roster inclusion"})});
 if(!response.ok)throw new Error("Roster inclusion failed");
}
