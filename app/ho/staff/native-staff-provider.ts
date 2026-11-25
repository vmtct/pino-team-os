// PAP-2358 · WFM-STAFF. Feature-local canonical read provider, not route-admitted.
import type {SurfaceProvider} from "@/lib/workspace-adapters/contracts";
import type {ManualStaffFields,ManualStaffRow} from "./manual-create-contract";
const canonical=(v:unknown):v is string=>typeof v==="string"&&/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(v);
const obj=(v:unknown):Record<string,unknown>|null=>v!==null&&typeof v==="object"&&!Array.isArray(v)?v as Record<string,unknown>:null;
const exact=(b:Record<string,unknown>,keys:readonly string[])=>Object.keys(b).length===keys.length&&keys.every(k=>Object.hasOwn(b,k));
const text=(v:unknown):v is string|null=>v===null||typeof v==="string";
const instant=(v:unknown):v is string=>typeof v==="string"&&/^\d{4}-\d{2}-\d{2}T/.test(v)&&Number.isFinite(Date.parse(v));
const day=(v:unknown):v is string=>typeof v==="string"&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&Number.isFinite(Date.parse(v))&&new Date(v).toISOString().slice(0,10)===v;
const base=["id","displayLabel","status","roleLabel","createdAt","updatedAt","createdByUserId","updatedByUserId"];
const detailKeys=["mobile","email","gender","birthDate","loginEmail","centers"];
function invalid():never{throw new Error("Invalid HO Staff projection");}
export function projectHoStaffRow(value:unknown,detail=false):ManualStaffRow{
  const b=obj(value);
  if(!b||!exact(b,detail?[...base,...detailKeys]:base)||!canonical(b.id)||typeof b.displayLabel!=="string"||!b.displayLabel.trim()||
     (b.status!=="active"&&b.status!=="inactive")||!text(b.roleLabel)||!instant(b.createdAt)||!instant(b.updatedAt)||
     (b.createdByUserId!==null&&!canonical(b.createdByUserId))||(b.updatedByUserId!==null&&!canonical(b.updatedByUserId)))invalid();
  const row:ManualStaffRow={id:b.id,name:b.displayLabel,status:b.status==="active"?"Đang làm":"Ngưng",role:b.roleLabel,
    createdAt:b.createdAt,updatedAt:b.updatedAt,createdBy:b.createdByUserId,updatedBy:b.updatedByUserId,
    phone:null,email:null,gender:null,birthDate:null,center:null,loginEmail:null};
  if(!detail)return row;
  if(!text(b.mobile)||!text(b.email)||!text(b.gender)||(b.birthDate!==null&&!day(b.birthDate))||!text(b.loginEmail)||!Array.isArray(b.centers))invalid();
  const ids=new Set<string>(),labels:string[]=[];
  for(const value of b.centers){
    const c=obj(value);
    if(!c||!exact(c,["id","label"])||!canonical(c.id)||ids.has(c.id)||typeof c.label!=="string"||!c.label.trim())invalid();
    ids.add(c.id);labels.push(c.label);
  }
  return {...row,phone:b.mobile,email:b.email,gender:b.gender,birthDate:b.birthDate,center:labels.length?labels.join(", "):null,loginEmail:b.loginEmail};
}
const path="/api/ho/staff/directory";
async function load(fetcher:typeof fetch,url:string,signal:AbortSignal):Promise<unknown>{
  const response=await fetcher(url,{method:"GET",credentials:"same-origin",cache:"no-store",redirect:"error",signal});
  signal.throwIfAborted();
  if(!response.ok)throw Error("HO Staff read unavailable");
  const root=obj(await response.json());signal.throwIfAborted();
  if(!root||!exact(root,["data"]))invalid();
  return root.data;
}
export const nativeManualStaffProvider:SurfaceProvider<ManualStaffFields>={
  pagination:"local-ui",
  async list(_query,scope,fetcher,signal){
    if(scope.surface!=="HO")throw Error("HO only");
    const data=await load(fetcher,path,signal);
    if(!Array.isArray(data))invalid();
    const ids=new Set<string>(),records=data.map(value=>{
      const row=projectHoStaffRow(value);
      if(ids.has(row.id))invalid();ids.add(row.id);return {row};
    });
    return {records,total:records.length};
  },
  async detail(id,scope,fetcher,signal){
    if(scope.surface!=="HO"||!canonical(id))throw Error("HO canonical Staff only");
    const data=await load(fetcher,path+"/"+id,signal);
    if(data===null)return null;
    const row=projectHoStaffRow(data,true);
    if(row.id!==id)invalid();
    return {row};
  },
};
