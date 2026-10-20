import {BoApiError} from './bo-api-error';

export type MissionPaperSize='B5'|'A4'|'A3';
export type MissionStatus='ACTIVE'|'INACTIVE';
export interface BoMission {
 id:string;code:string;name:string;level:number;status:MissionStatus;
 description:string|null;guideline:string|null;plsValue:number;paperSize:MissionPaperSize|null;
 pathProgramId:string|null;pathKeySnapshot:string|null;
 prerequisiteMissionId:string|null;prerequisiteCodeSnapshot:string|null;
 reconciliation:'READY'|'PENDING';diagnostics:string[];
 version:number;createdAt:string;updatedAt:string;
}
export interface BoMissionDraft {
 code:string;name:string;level:number;status:MissionStatus;description:string|null;guideline:string|null;
 plsValue:number;paperSize:MissionPaperSize|null;pathProgramId:string|null;pathKeySnapshot:string|null;
 prerequisiteMissionId:string|null;prerequisiteCodeSnapshot:string|null;
}
export interface BoMissionQuery {
 search?:string;status?:MissionStatus;level?:number;pathProgramId?:string;limit?:number;offset?:number;
}
export function missionListPath(query:BoMissionQuery){
 const qs=new URLSearchParams();
 Object.entries(query).forEach(([key,value])=>{if(value!==undefined&&value!==null&&String(value)!=='')qs.set(key,String(value))});
 return 'learning/missions?'+qs.toString();
}
async function request<T>(path:string,init:RequestInit={}):Promise<T>{
 const response=await fetch('/api/bo/'+path,{...init,cache:'no-store'});
 let body:{data?:T;error?:{message?:string;code?:string;requestId?:string}};
 try{body=await response.json() as typeof body;}catch{throw new BoApiError(response.status,'Invalid Mission Catalog response',response.headers.get('x-request-id'),false);}
 if(!response.ok||body.data===undefined)throw new BoApiError(response.status,body.error?.message??'Mission Catalog request failed',response.headers.get('x-request-id')??body.error?.requestId??null,Boolean(body.error?.message));
 return body.data;
}
function command(init:'POST'|'PUT',body:unknown,key:string):RequestInit{
 return {method:init,headers:{'content-type':'application/json','idempotency-key':key},body:JSON.stringify(body)};
}
export const boMissions={
 list:(q:BoMissionQuery)=>request<BoMission[]>(missionListPath(q)),
 get:(id:string)=>request<BoMission>('learning/missions/'+encodeURIComponent(id)),
 create:(body:BoMissionDraft,key:string)=>request<BoMission>('learning/missions',command('POST',body,key)),
 update:(id:string,body:BoMissionDraft&{expectedVersion:number},key:string)=>request<BoMission>('learning/missions/'+encodeURIComponent(id),command('PUT',body,key))
};
