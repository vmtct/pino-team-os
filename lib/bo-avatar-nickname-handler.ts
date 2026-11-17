// PAP-1847 / Epic PAP-1705 PNR-AVATAR-CRUD — bounded BO Avatar Nickname PATCH BFF.
// Only forwards the authenticated session, selected Center, version and nickname.
import { callBoAccessCoreWithCredential, type BoAccessCoreBinding, type BoAccessRequest } from "./bo-core";
import { teamCredential, TeamAuthError, type TeamAccessEnv } from "./team-auth";

export type BoAvatarNicknameEnv = TeamAccessEnv & {PINO_BO_CORE: BoAccessCoreBinding};
const UUID_V7 = "[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}";
const pathRx = new RegExp("^pinoria/avatars/(" + UUID_V7 + ")$");
const centerRx = new RegExp("^" + UUID_V7 + "$");
const response = (body:unknown,status:number,requestId?:string) =>
  Response.json(body,{status,headers:{"cache-control":"no-store",...(requestId?{"x-request-id":requestId}:{})}});
class Invalid extends Error {}
export function isBoAvatarNicknamePath(path:string):boolean { return pathRx.test(path); }

export async function handleBoAvatarNicknameRequest(request:Request,env:BoAvatarNicknameEnv,path:string,
  keyResolver?:Parameters<typeof teamCredential>[3]):Promise<Response> {
  try {
    if(!isBoAvatarNicknamePath(path)) return response({error:{code:"PLATFORM_NOT_FOUND"}},404);
    if(request.method!=="PATCH") return response({error:{code:"PLATFORM_METHOD_NOT_ALLOWED"}},405);
    const params=[...new URL(request.url).searchParams.entries()];
    if(params.length!==1 || params[0]?.[0]!=="centerId" || !centerRx.test(params[0][1]))
      throw new Invalid("Exactly one selected canonical Center required");
    if((request.headers.get("content-type")??"").split(";")[0].trim().toLowerCase()!=="application/json")
      throw new Invalid("JSON required");
    let raw:unknown;
    try{raw=await request.json()}catch{throw new Invalid("Malformed JSON")}
    if(!raw||typeof raw!=="object"||Array.isArray(raw)) throw new Invalid("Object body required");
    const body=raw as Record<string,unknown>;
    if(Object.keys(body).sort().join(",")!=="expectedSelfVersion,nickname" ||
      !Number.isSafeInteger(body.expectedSelfVersion)||Number(body.expectedSelfVersion)<1)
      throw new Invalid("Only Nickname and positive expectedSelfVersion permitted");
    const nickname=body.nickname;
    if(nickname!==null && typeof nickname!=="string") throw new Invalid("Nickname string or null required");
    const normalized=typeof nickname==="string" ? nickname.normalize("NFC").trim() : null;
    if(normalized!==null && (!normalized || [...normalized].length>40 ||
       [...normalized].some(ch=>/[\u0000-\u001f\u007f-\u009f]/u.test(ch))))
      throw new Invalid("Nickname phải có từ 1 đến 40 ký tự hợp lệ, hoặc null để xóa");
    const credential=await teamCredential(request,env,"BO",keyResolver);
    const forward:BoAccessRequest={
      method:"PATCH",path,resource:{centerId:params[0][1]},
      body:{nickname:normalized,expectedSelfVersion:body.expectedSelfVersion}
    };
    const core=await callBoAccessCoreWithCredential(env.PINO_BO_CORE,forward,credential);
    return response(core.body,core.status,core.requestId);
  }catch(e){
    if(e instanceof TeamAuthError)return response({error:{code:"IDENTITY_AUTHENTICATION_FAILED",message:e.message}},e.status);
    if(e instanceof Invalid)return response({error:{code:"PLATFORM_INVALID_INPUT",message:e.message}},400);
    console.error("PAP-1847 Avatar Nickname BFF",e instanceof Error?e.name:"unknown");
    return response({error:{code:"PLATFORM_INTERNAL_ERROR"}},500);
  }
}
