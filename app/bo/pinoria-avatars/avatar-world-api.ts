/** PAP-2153 / PAP-8 PNR-WORLD: unmounted BO client for the selected-Center contract.
 * Deliberately inject transport; no live caller or permission admission here. */
import {parseAvatarWorld,buildWorldCommand,verifyWorldReadback,type Scope,type AvatarWorldState,type WorldIntent} from "./avatar-world-contract";
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
function path(scope:Scope,command=false){
 if(![scope.selfId,scope.centerId,scope.studentProfileId].every(x=>UUID.test(x)))throw Error("Avatar/Center không hợp lệ.");
 return "/api/bo/pinoria/avatars/"+scope.selfId+"/world"+(command?"/commands":"")+"?"+new URLSearchParams({centerId:scope.centerId});
}
export class AvatarWorldApiError extends Error{
 constructor(readonly status:number,readonly requestId:string|null){
  super(status===401?"Phiên đăng nhập đã hết hạn.":status===403?"Không có quyền World tại Center này.":status===404?"Avatar hoặc World không còn khả dụng.":status===409?"World đã thay đổi. Vui lòng tải lại.":"Core chưa xác nhận thao tác World.");
 }
}
async function request(fetcher:typeof fetch,url:string,signal:AbortSignal,expected:number,init:RequestInit={}):Promise<unknown>{
 const response=await fetcher(url,{...init,credentials:"same-origin",cache:"no-store",redirect:"error",signal});
 if(response.status!==expected)throw new AvatarWorldApiError(response.status,response.headers.get("x-request-id"));
 const raw:unknown=await response.json();
 if(!raw||typeof raw!=="object"||Array.isArray(raw)||!Object.hasOwn(raw,"data"))throw Error("Core không trả về dữ liệu World.");
 return (raw as {data:unknown}).data;
}
export async function loadAvatarWorld(scope:Scope,fetcher:typeof fetch,signal:AbortSignal):Promise<AvatarWorldState>{
 return parseAvatarWorld(await request(fetcher,path(scope),signal,200,{method:"GET"}),scope);
}
/** Caller must hold the original replay key for an uncertain outcome; no auto-retry. */
export async function mutateAvatarWorld(previous:AvatarWorldState,intent:WorldIntent,grants:ReadonlySet<string>,replayKey:string,fetcher:typeof fetch,signal:AbortSignal){
 const scope:Scope={selfId:previous.selfId,centerId:previous.centerId,studentProfileId:previous.studentProfileId};
 if(!replayKey||replayKey.trim()!==replayKey||replayKey.length>200||/[\u0000-\u001f\u007f]/.test(replayKey))throw Error("Thiếu mã xác nhận thao tác World hợp lệ.");
 const command=buildWorldCommand(previous,intent,grants);
 const receipt=await request(fetcher,path(scope,true),signal,command.kind==="grant"?201:200,{method:"POST",headers:{"content-type":"application/json","idempotency-key":replayKey},body:JSON.stringify(command)});
 const fresh=await loadAvatarWorld(scope,fetcher,signal);
 const instance=verifyWorldReadback(previous,command,receipt,fresh);
 return {state:fresh,instance};
}
