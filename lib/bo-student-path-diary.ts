/** PAP-2221 · BO Student Detail — authorized student-scoped Path Diary adapter.
 * Reads the Core Path Diary projection and source-owned Diary→Mission links only.
 * Classroom Diary, Attendance, and inferred date/session relationships are excluded.
 */
export type StudentPathDiaryMissionLink={
 id:string;diaryId:string;missionId:string;missionCode:string;missionName:string;
 missionStatus:string;assignmentId:string|null;linkedAt:string;linkedByUserId:string;
};
export type StudentPathDiary={
 id:string;centerId:string;studentId:string;studentDisplayName?:string;
 teachingContextKey:string;pathKey:string;runningClassId:string|null;runningClassDisplayName?:string;
 centerDisplayName?:string;status:"REGISTERED"|"CLOSED";interest:number|null;notes:string|null;difficulty:string|null;
 registeredAt:string;registeredByUserId:string;registeredByDisplayName?:string;
 draftSavedAt:string|null;draftSavedByUserId:string|null;closedAt:string|null;closedByUserId:string|null;
 updatedAt:string;draftSavedVersion:number|null;version:number;missionLinks:StudentPathDiaryMissionLink[];
};
type DiaryPage={centerId:string;studentProfileId:string;diaries:StudentPathDiary[];limit:number;offset:number;hasMore:boolean};
const ID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function date(value:unknown):value is string{return typeof value==="string"&&Number.isFinite(Date.parse(value))}
function validLink(value:unknown,diaryId:string):value is StudentPathDiaryMissionLink{
 if(!value||typeof value!=="object"||Array.isArray(value))return false;
 const x=value as Partial<StudentPathDiaryMissionLink>;
 return Boolean(ID.test(x.id??"")&&x.diaryId===diaryId&&ID.test(x.missionId??"")&&
  typeof x.missionCode==="string"&&x.missionCode.trim()&&typeof x.missionName==="string"&&x.missionName.trim()&&
  typeof x.missionStatus==="string"&&date(x.linkedAt)&&ID.test(x.linkedByUserId??"")&&
  (x.assignmentId===null||ID.test(x.assignmentId??"")));
}
function validDiary(value:unknown,centerId:string,studentId:string):value is StudentPathDiary{
 if(!value||typeof value!=="object"||Array.isArray(value))return false;
 const x=value as Partial<StudentPathDiary>;
 return Boolean(ID.test(x.id??"")&&x.centerId===centerId&&x.studentId===studentId&&
  typeof x.teachingContextKey==="string"&&x.teachingContextKey.length>0&&typeof x.pathKey==="string"&&
  (x.runningClassId===null||ID.test(x.runningClassId??""))&&
  ["REGISTERED","CLOSED"].includes(x.status??"")&&
  (x.interest===null||(Number.isInteger(x.interest)&&x.interest!>=1&&x.interest!<=4))&&
  (x.notes===null||typeof x.notes==="string")&&(x.difficulty===null||typeof x.difficulty==="string")&&
  date(x.registeredAt)&&ID.test(x.registeredByUserId??"")&&date(x.updatedAt)&&
  (x.draftSavedAt===null||date(x.draftSavedAt))&&
  (x.draftSavedByUserId===null||ID.test(x.draftSavedByUserId??""))&&
  (x.closedAt===null||date(x.closedAt))&&
  (x.closedByUserId===null||ID.test(x.closedByUserId??""))&&
  (x.draftSavedVersion===null||(Number.isSafeInteger(x.draftSavedVersion)&&x.draftSavedVersion!>=1))&&
  Number.isSafeInteger(x.version)&&x.version!>=1&&Array.isArray(x.missionLinks)&&x.missionLinks.length<=100&&
  x.missionLinks.every(link=>validLink(link,x.id!))&&
  (!("studentDisplayName" in x)||typeof x.studentDisplayName==="string")&&
  (!("runningClassDisplayName" in x)||typeof x.runningClassDisplayName==="string")&&
  (!("centerDisplayName" in x)||typeof x.centerDisplayName==="string")&&
  (!("registeredByDisplayName" in x)||typeof x.registeredByDisplayName==="string"));
}
async function readData(fetcher:typeof fetch,path:string,signal:AbortSignal):Promise<unknown>{
 signal.throwIfAborted();
 const response=await fetcher(path,{method:"GET",cache:"no-store",signal});
 signal.throwIfAborted();
 if(!response.ok)throw Error("Không thể đọc Diary của học viên ("+response.status+").");
 const body:unknown=await response.json();signal.throwIfAborted();
 if(!body||typeof body!=="object"||Array.isArray(body)||!("data" in body))throw Error("Phản hồi Diary không hợp lệ.");
 return body.data;
}
/** Load the full bounded server projection; fail visibly instead of silently truncating. */
export async function readStudentPathDiaries(
 fetcher:typeof fetch,centerId:string,studentId:string,signal:AbortSignal,
):Promise<readonly StudentPathDiary[]>{
 if(!ID.test(centerId)||!ID.test(studentId))throw Error("Cần chọn Center và học viên hợp lệ.");
 const records:StudentPathDiary[]=[],ids=new Set<string>(),links=new Set<string>();
 for(let offset=0;offset<=10000;offset+=100){
  const query=new URLSearchParams({centerId,limit:"100",offset:String(offset)});
  const data=await readData(fetcher,"/api/bo/learning/students/"+encodeURIComponent(studentId)+"/path-diaries?"+query,signal);
  if(!data||typeof data!=="object"||Array.isArray(data))throw Error("Trang Diary không hợp lệ.");
  const page=data as Partial<DiaryPage>;
  if(page.centerId!==centerId||page.studentProfileId!==studentId||page.limit!==100||page.offset!==offset||
    !Array.isArray(page.diaries)||page.diaries.length>100||typeof page.hasMore!=="boolean"||
    page.diaries.some(row=>!validDiary(row,centerId,studentId)))throw Error("Sai phạm vi hoặc cấu trúc Diary.");
  for(const row of page.diaries){
   if(ids.has(row.id))throw Error("Diary bị lặp trong kết quả Core.");
   ids.add(row.id);
   for(const link of row.missionLinks){
    if(links.has(link.id))throw Error("Liên kết Diary–Nhiệm vụ bị lặp trong kết quả Core.");
    links.add(link.id);
   }
   records.push(row);
  }
  if(!page.hasMore)return records;
  if(page.diaries.length!==100)throw Error("Phân trang Diary không nhất quán.");
 }
 throw Error("Danh sách vượt phạm vi phân trang hỗ trợ; không hiển thị kết quả bị cắt.");
}
