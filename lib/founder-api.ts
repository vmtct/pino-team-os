import type{CanonicalError,FounderData,PathProgram,Registration,RunningClass,Session,Syllabus}from"./founder-model";
export class FounderApiError extends Error{constructor(readonly status:number,readonly code:string,message:string){super(message);}}
async function request<T>(path:string,init:RequestInit={}):Promise<T>{const response=await fetch(`/api/founder${path}`,{cache:"no-store",...init,headers:{...(init.body instanceof FormData?{}:{"content-type":"application/json"}),...init.headers}});const body=await response.json() as T&CanonicalError;if(!response.ok)throw new FounderApiError(response.status,body.error?.code??"UNKNOWN",body.error?.message??"Không thể hoàn tất yêu cầu.");return body;}
export const founderApi={
 listPaths:()=>request<{data:PathProgram[]}>("/path-programs"),listClasses:()=>request<{data:RunningClass[]}>("/running-classes"),listSyllabi:()=>request<{data:Syllabus[]}>("/syllabi"),listSessions:()=>request<{data:Session[]}>("/sessions"),
 registrations:(id:string)=>request<{data:Registration[]}>(`/sessions/${id}/registrations`),
 mutate:(path:string,method:string,body:unknown,key?:string)=>request<unknown>(path,{method,body:JSON.stringify(body),headers:key?{"idempotency-key":key}:{}}),
 upload:(data:FormData)=>request<{id:string;publicUrl:string;mimeType:string;byteSize:number;objectKey:string}>("/media",{method:"POST",body:data}),
};
export async function loadFounderData():Promise<FounderData>{const[paths,classes,syllabi,sessions]=await Promise.all([founderApi.listPaths(),founderApi.listClasses(),founderApi.listSyllabi(),founderApi.listSessions()]);const registrations=(await Promise.all(sessions.data.map(s=>founderApi.registrations(s.id)))).flatMap(x=>x.data);return{paths:paths.data,classes:classes.data,syllabi:syllabi.data,sessions:sessions.data,registrations};}
