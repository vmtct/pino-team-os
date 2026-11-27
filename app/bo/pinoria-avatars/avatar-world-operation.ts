/** PAP-2153 — one immutable operation while its outcome is uncertain. */
import {buildWorldCommand,type AvatarWorldState,type WorldIntent,type WorldCommand,type Scope} from "./avatar-world-contract";
export type PendingWorldOperation=Readonly<{scope:Readonly<Scope>;intent:Readonly<WorldIntent>;command:Readonly<WorldCommand>;key:string}>;
export function beginWorldOperation(state:AvatarWorldState,intent:WorldIntent,grants:ReadonlySet<string>,key:string):PendingWorldOperation{
 if(!key||key.trim()!==key||key.length>200)throw Error("Thiếu mã thao tác.");
 const command=buildWorldCommand(state,intent,grants);
 return Object.freeze({scope:Object.freeze({selfId:state.selfId,centerId:state.centerId,studentProfileId:state.studentProfileId}),intent:Object.freeze({...intent}),command:Object.freeze(command),key});
}
export function resumeWorldOperation(pending:PendingWorldOperation,state:AvatarWorldState,grants:ReadonlySet<string>){
 const allowed=buildWorldCommand(state,pending.intent,grants);
 if(state.selfId!==pending.scope.selfId||state.centerId!==pending.scope.centerId||state.studentProfileId!==pending.scope.studentProfileId||JSON.stringify(allowed)!==JSON.stringify(pending.command))throw Error("Trạng thái đã thay đổi. Cần đọc lại kết quả trước khi tiếp tục.");
 return pending;
}
