/** PAP-2096 — private HO catalog client. No optimistic append or automatic write retry. */
import {mapHoWorlds} from "@/lib/ho-a1";
import type {BoRecord} from "@/lib/bo-registration";
import {assertWorldCreated,type CreateWorldPayload} from "./world-drawer-contract";
const path="/api/ho/pinoria/worlds",idPattern=/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
type JSONObject=Record<string,unknown>;
function object(v:unknown):JSONObject{if(!v||typeof v!=="object"||Array.isArray(v))throw Error("Dữ liệu World không hợp lệ.");return v as JSONObject}
function string(v:unknown):string{if(typeof v!=="string")throw Error("Dữ liệu World không hợp lệ.");return v}
const date=(v:unknown)=>typeof v==="string"&&Number.isFinite(Date.parse(v))?v:null;
const actor=(v:unknown)=>typeof v==="string"&&v.trim()&&v.length<=160?v.trim():"—";
export function mapWorldDrawerRow(v:unknown):BoRecord{
 const w=object(v),id=string(w.id);if(!idPattern.test(id)||!Array.isArray(w.scenes))throw Error("World không có định danh hợp lệ.");
 const scenes=w.scenes.map(object);if(scenes.some(s=>!Array.isArray(s.layers)))throw Error("World thiếu dữ liệu cảnh.");
 const worldType=string(w.worldType),status=string(w.status);
 if(!["CORE","SUMMER","SPECIAL","OTHER"].includes(worldType)||!["DRAFT","ACTIVE","ARCHIVED"].includes(status))throw Error("Trạng thái World không hợp lệ.");
 return {...mapHoWorlds({worlds:[w]})[0],id,name:string(w.displayName),key:string(w.key),worldType,status,sceneCount:scenes.length,layerCount:scenes.reduce((sum,s)=>sum+(s.layers as unknown[]).length,0),createdAt:date(w.createdAt),updatedAt:date(w.updatedAt),createdByUser:actor(w.createdByUser),updatedByUser:actor(w.updatedByUser)};
}
async function data(fetcher:typeof fetch,init:RequestInit):Promise<unknown>{
 const r=await fetcher(path,{...init,cache:"no-store",credentials:"same-origin"});let b:JSONObject;
 try{b=object(await r.json())}catch{throw Error("Không thể xác minh phản hồi World.")}
 if(!r.ok)throw Error("World chưa được xác nhận (HTTP "+r.status+").");
 if(!Object.hasOwn(b,"data"))throw Error("World thiếu dữ liệu trả về.");
 return b.data;
}
export async function loadWorlds(fetcher:typeof fetch=fetch,signal?:AbortSignal):Promise<BoRecord[]>{
 const raw=object(await data(fetcher,{method:"GET",signal:signal??AbortSignal.timeout(15000)}));
 if(!Array.isArray(raw.worlds))throw Error("Danh mục World không hợp lệ.");
 const rows=raw.worlds.map(mapWorldDrawerRow);if(new Set(rows.map(r=>r.id)).size!==rows.length)throw Error("Danh mục World có ID trùng.");
 return rows;
}
export async function createWorldAndReadback(payload:CreateWorldPayload,fetcher:typeof fetch=fetch,key=crypto.randomUUID()):Promise<BoRecord>{
 const returned=mapWorldDrawerRow(await data(fetcher,{method:"POST",headers:{"content-type":"application/json","idempotency-key":key},body:JSON.stringify(payload),signal:AbortSignal.timeout(15000)}));
 assertWorldCreated(returned,payload);
 const fresh=(await loadWorlds(fetcher)).find(w=>w.id===returned.id);if(!fresh)throw Error("World vừa tạo chưa có trong danh mục.");
 assertWorldCreated(fresh,payload);
 if(!fresh.createdAt||!fresh.updatedAt||fresh.createdAt!==returned.createdAt||fresh.updatedAt!==returned.updatedAt)throw Error("Chưa xác minh được audit timestamp.");
 return fresh;
}
