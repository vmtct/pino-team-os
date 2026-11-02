/** PAP-1342 / Epic PAP-727: strict source-owned Diary→Mission read projection.
 * Both BFF endpoints independently enforce Founder HO GLOBAL / Manager BO Center ACL.
 * Never infer a Mission from student, path, attendance, or a CLOSED Diary.
 */
export type DiaryMissionSurface="HO"|"BO";
export type DiaryLinkSource={id:string;diaryId:string;missionId:string;assignmentId:string|null};
export type DiaryMissionRef={id:string;centerId:string};
const ID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const NO_LINK="Chưa liên kết nhiệm vụ";

async function sourceData(fetcher:typeof fetch,path:string,signal:AbortSignal):Promise<unknown>{
 signal.throwIfAborted();
 const r=await fetcher(path,{method:"GET",cache:"no-store",signal});
 signal.throwIfAborted();
 if(!r.ok)throw Error("Nguồn liên kết Mission không khả dụng ("+r.status+").");
 const body:unknown=await r.json();
 signal.throwIfAborted();
 if(!body||typeof body!=="object"||Array.isArray(body)||!("data" in body))
  throw Error("Nguồn liên kết Mission thiếu data.");
 return body.data;
}
function validLink(value:unknown,diaryId:string):value is DiaryLinkSource{
 if(!value||typeof value!=="object"||Array.isArray(value))return false;
 const v=value as Partial<DiaryLinkSource>;
 return Boolean(ID.test(v.id??"")&&v.diaryId===diaryId&&ID.test(v.missionId??"")&&
  (v.assignmentId===null||ID.test(v.assignmentId??"")));
}
export async function readDiaryMissionLabels(
 fetcher:typeof fetch,rows:readonly DiaryMissionRef[],surface:DiaryMissionSurface,centerId:string,signal:AbortSignal,
):Promise<ReadonlyMap<string,string>>{
 if(surface==="BO"&&!ID.test(centerId))throw Error("Center scope required for BO Mission projection");
 const result=new Map<string,string>();
 const missionNames=new Map<string,Promise<string>>();
 const ids=new Set<string>();
 let cursor=0;
 async function missionLabel(missionId:string):Promise<string>{
  const cached=missionNames.get(missionId);
  if(cached)return cached;
  const path=(surface==="HO"?"/api/ho/learning/missions/":"/api/bo/learning/missions/")+missionId+
   (surface==="BO"?"?centerId="+encodeURIComponent(centerId):"");
  const promise=(async()=>{
   const value=await sourceData(fetcher,path,signal);
   if(!value||typeof value!=="object"||Array.isArray(value))throw Error("Invalid Mission source");
   const v=value as {id?:unknown;code?:unknown;name?:unknown};
   if(v.id!==missionId||typeof v.code!=="string"||!v.code.trim()||
    typeof v.name!=="string"||!v.name.trim())throw Error("Mission source identity mismatch");
   return v.code+" — "+v.name;
  })();
  missionNames.set(missionId,promise);
  return promise;
 }
 async function worker(){
  while(cursor<rows.length){
   const row=rows[cursor++];
   if(!row||!ID.test(row.id)||!ID.test(row.centerId)||
    (surface==="BO"&&row.centerId!==centerId)||ids.has(row.id))
    throw Error("Diary Mission projection identity/Center mismatch");
   ids.add(row.id);
   const path=(surface==="HO"?"/api/ho/learning/path-diaries/":"/api/bo/learning/path-diaries/")+
     row.id+"/mission-links"+(surface==="BO"?"?centerId="+encodeURIComponent(centerId):"");
   const raw=await sourceData(fetcher,path,signal);
   if(!Array.isArray(raw)||raw.length>100||raw.some(x=>!validLink(x,row.id)))
    throw Error("Invalid source-owned Diary Mission links");
   const links=raw as DiaryLinkSource[];
   if(new Set(links.map(x=>x.id)).size!==links.length)
    throw Error("Duplicate Mission link identity");
   if(!links.length){result.set(row.id,NO_LINK);continue}
   const distinct=[...new Set(links.map(x=>x.missionId))];
   const labels=await Promise.all(distinct.map(missionLabel));
   result.set(row.id,labels.join(" · "));
  }
 }
 await Promise.all(Array.from({length:Math.min(rows.length,6)},worker));
 if(result.size!==rows.length)throw Error("Mission projection incomplete");
 return result;
}