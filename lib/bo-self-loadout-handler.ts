/** PAP-1356 / PAP-1097 S5 — BO-only gateway to canonical Core Self Loadout. */
import { callBoAccessCoreWithCredential, type BoAccessCoreBinding, type BoAccessRequest } from "./bo-core";
import { teamCredential, TeamAuthError, type TeamAccessEnv } from "./team-auth";

export interface BoSelfLoadoutEnv extends TeamAccessEnv {
  PINO_BO_CORE: BoAccessCoreBinding;
}
const V7 = "[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}";
const PATH = new RegExp("^pinoria/selfs/(" + V7 + ")/loadout$");
const MEDIA = new RegExp("^pinoria/selfs/(" + V7 + ")/loadout/media/(AURA_GROUND|AURA_BACK|BACK|OUTFIT|HAIR|FACE|HEADWEAR|PATH_MARK)$");
const ID = new RegExp("^" + V7 + "$");
const SET = new RegExp("^pinoria/selfs/(" + V7 + ")/set$");
const SET_MEDIA = new RegExp("^pinoria/selfs/(" + V7 + ")/set/media/([0-7])$");
const SET_COMMAND = new RegExp("^pinoria/selfs/(" + V7 + ")/set/(apply|clear|starter)$");
export const SELF_LOADOUT_SLOTS = ["AURA_GROUND","AURA_BACK","BACK","OUTFIT","HAIR","FACE","HEADWEAR","PATH_MARK"] as const;

export function isBoSelfLoadoutPath(path: string): boolean { return PATH.test(path) || MEDIA.test(path) || SET.test(path) || SET_MEDIA.test(path) || SET_COMMAND.test(path); }
class InvalidInput extends Error {}
async function setBody(request: Request, apply: boolean) {
  if ((request.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase() !== "application/json") throw new InvalidInput("JSON content type required");
  let raw: unknown;
  try { raw = await request.json(); } catch { throw new InvalidInput("Invalid JSON"); }
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new InvalidInput("Object body required");
  const r = raw as Record<string, unknown>;
  const keys = ["expectedVersion", "expectedSelfVersion", "reason", ...(apply ? ["setItemId"] : [])];
  if (Object.keys(r).sort().join(",") !== keys.sort().join(",") ||
      !Number.isSafeInteger(r.expectedVersion) || Number(r.expectedVersion) < 0 ||
      !Number.isSafeInteger(r.expectedSelfVersion) || Number(r.expectedSelfVersion) < 1 ||
      typeof r.reason !== "string" || !r.reason.trim() || r.reason.trim().length > 1000 ||
      (apply && (typeof r.setItemId !== "string" || !ID.test(r.setItemId)))) throw new InvalidInput("Invalid Set command");
  return { ...r, reason: r.reason.trim() };
}
function centerIdOf(request: Request): string {
  const qs=[...new URL(request.url).searchParams.entries()];
  if(qs.length!==1 || qs[0]?.[0]!=="centerId" || !ID.test(qs[0][1])) throw new InvalidInput("Exactly one canonical centerId required");
  return qs[0][1];
}
function idempotencyKeyOf(request: Request): string {
  const key=request.headers.get("idempotency-key");
  if(!key || key.trim()!==key || key.length<8 || key.length>200 || /[\r\n]/.test(key)) throw new InvalidInput("Idempotency-Key required");
  return key;
}
async function saveBody(request: Request) {
  if(!(request.headers.get("content-type")??"").toLowerCase().startsWith("application/json")) throw new InvalidInput("JSON content type required");
  let raw:unknown;
  try { raw=await request.json(); } catch { throw new InvalidInput("Invalid JSON"); }
  if(!raw || typeof raw!=="object" || Array.isArray(raw)) throw new InvalidInput("Object body required");
  const r=raw as Record<string,unknown>;
  if(Object.keys(r).sort().join(",")!=="expectedVersion,itemIdsBySlot,reason" || !Number.isSafeInteger(r.expectedVersion) || Number(r.expectedVersion)<0 || typeof r.reason!=="string" || !r.reason.trim() || r.reason.trim().length>1000) throw new InvalidInput("Invalid SaveSlots input");
  if(!r.itemIdsBySlot || typeof r.itemIdsBySlot!=="object" || Array.isArray(r.itemIdsBySlot)) throw new InvalidInput("Eight slots required");
  const slots=r.itemIdsBySlot as Record<string,unknown>;
  if(Object.keys(slots).sort().join(",")!==[...SELF_LOADOUT_SLOTS].sort().join(",") || SELF_LOADOUT_SLOTS.some(s=>{ const item=slots[s]; return item!==null && (typeof item!=="string" || !ID.test(item)); })) throw new InvalidInput("Every canonical slot must contain Item ID or null");
  return { expectedVersion:Number(r.expectedVersion), itemIdsBySlot:slots, reason:r.reason.trim() };
}
function media(result: { body: unknown; status: number; requestId: string }): Response {
  if (result.status !== 200) return json(result.body, result.status, result.requestId);
  const envelope = result.body as { data?: { mimeType?:unknown; byteSize?:unknown; bytesBase64?:unknown } } | null;
  const data=envelope?.data;
  if (!data || (data.mimeType !== "image/png" && data.mimeType !== "image/webp") ||
      !Number.isSafeInteger(data.byteSize) || Number(data.byteSize)<1 || Number(data.byteSize)>10*1024*1024 ||
      typeof data.bytesBase64 !== "string" || data.bytesBase64.length>14*1024*1024 ||
      !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(data.bytesBase64))
    return json({error:{code:"PLATFORM_UPSTREAM_INVALID_MEDIA"}},502,result.requestId);
  const bytes=Buffer.from(data.bytesBase64,"base64");
  if (bytes.length!==data.byteSize ||
      (data.mimeType==="image/png" && !Buffer.from([137,80,78,71,13,10,26,10]).equals(bytes.subarray(0,8))) ||
      (data.mimeType==="image/webp" && (bytes.length<12 || bytes.toString("ascii",0,4)!=="RIFF" || bytes.toString("ascii",8,12)!=="WEBP")))
    return json({error:{code:"PLATFORM_UPSTREAM_INVALID_MEDIA"}},502,result.requestId);
  return new Response(new Uint8Array(bytes),{status:200,headers:{
    "content-type":data.mimeType,"content-length":String(bytes.length),
    "cache-control":"private, no-store, max-age=0","x-content-type-options":"nosniff",
    "x-request-id":result.requestId,
  }});
}
function json(body:unknown,status:number,requestId?:string) {
  return Response.json(body,{status,headers:{"cache-control":"no-store",...(requestId?{"x-request-id":requestId}:{})}});
}
export async function handleBoSelfLoadoutRequest(request:Request,env:BoSelfLoadoutEnv,path:string,keyResolver?:Parameters<typeof teamCredential>[3]):Promise<Response> {
  try {
    if(!isBoSelfLoadoutPath(path)) return json({error:{code:"PLATFORM_NOT_FOUND"}},404);
    const isMedia=MEDIA.test(path)||SET_MEDIA.test(path);
    if ((SET.test(path) && request.method !== "GET") || (SET_COMMAND.test(path) && request.method !== "POST")) return json({error:{code:"PLATFORM_METHOD_NOT_ALLOWED"}},405);
    if((isMedia && request.method!=="GET") || (request.method!=="GET" && request.method!=="POST")) return json({error:{code:"PLATFORM_METHOD_NOT_ALLOWED"}},405);
    const centerId=centerIdOf(request);
    const key=request.method==="POST"?idempotencyKeyOf(request):undefined;
    const body=request.method==="POST"?(SET_COMMAND.test(path)?await setBody(request,path.endsWith("/apply") || path.endsWith("/starter")):await saveBody(request)):undefined;
    const credential=await teamCredential(request,env,"BO",keyResolver);
    const coreRequest:BoAccessRequest={method:request.method,path,resource:{centerId},...(body?{body}:{}),...(key?{idempotencyKey:key}:{})};
    const result=await callBoAccessCoreWithCredential(env.PINO_BO_CORE,coreRequest,credential);
    return isMedia ? media(result) : json(result.body,result.status,result.requestId);
  } catch(error) {
    if(error instanceof TeamAuthError) return json({error:{code:"IDENTITY_AUTHENTICATION_FAILED",message:error.message}},error.status);
    if(error instanceof InvalidInput) return json({error:{code:"PLATFORM_INVALID_INPUT",message:error.message}},400);
    console.error("PAP-1356 Self Loadout facade",error instanceof Error?error.name:"unknown");
    return json({error:{code:"PLATFORM_INTERNAL_ERROR"}},500);
  }
}
