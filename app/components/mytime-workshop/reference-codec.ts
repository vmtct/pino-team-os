// PAP-2164 / PAP-2158 MT-WORKSHOP: renderer supports string options.
// Keep canonical identities in a separate bijection; labels are presentation tokens only.
export type WorkshopReference={id:string;label:string|null};
export const isWorkshopId=(id:unknown):id is string=>typeof id==="string"&&/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(id);
export function workshopReferenceCodec(active:readonly WorkshopReference[],historical:readonly WorkshopReference[]){
 const byId=new Map<string,string|null>();
 for(const row of [...historical,...active]){
  if(!isWorkshopId(row.id)||!(row.label===null||typeof row.label==="string"))throw new Error("Dữ liệu tham chiếu Workshop không hợp lệ.");
  byId.set(row.id,row.label?.trim()||null);
 }
 const counts=new Map<string,number>();
 const base=(value:string|null)=>value??"Không xác định";
 for(const label of byId.values())counts.set(base(label),(counts.get(base(label))??0)+1);
 const tokenById=new Map<string,string>(),idByToken=new Map<string,string>();
 // Reserve unique human labels before generating duplicate-name tokens.
 for(const [id,label] of byId)if(label!==null&&counts.get(label)===1){tokenById.set(id,label);idByToken.set(label,id);}
 for(const [id,label] of [...byId].sort(([a],[b])=>a.localeCompare(b))){
  if(tokenById.has(id))continue;
  let token=base(label)+" · "+id.slice(-8);
  if(idByToken.has(token))token=base(label)+" · "+id;
  while(idByToken.has(token))token+=" ·";
  tokenById.set(id,token);idByToken.set(token,id);
 }
 const activeIds=new Set(active.map(r=>r.id));
 const options=[...activeIds].map(id=>tokenById.get(id)!).sort((a,b)=>a.localeCompare(b,"vi"));
 function display(id:string):string{const token=tokenById.get(id);if(token===undefined)throw new Error("Thiếu tham chiếu Workshop.");return token;}
 function resolve(token:string,allowHistoricalId?:string):string{
  const id=idByToken.get(token);
  if(!id||(!activeIds.has(id)&&id!==allowHistoricalId))throw new Error("Tham chiếu Workshop không còn khả dụng.");
  return id;
 }
 function resolveMany(tokens:readonly string[],previous:readonly string[]=[]):string[]{
  const ids=tokens.map(token=>{const id=idByToken.get(token);if(!id||(!activeIds.has(id)&&!previous.includes(id)))throw new Error("Tham chiếu Workshop không còn khả dụng.");return id;});
  if(new Set(ids).size!==ids.length)throw new Error("Tham chiếu Workshop bị trùng.");
  return ids.sort();
 }
 // Newly read records may refer to an identity absent from the initial list.
 // Preserve existing tokens (including edit selections); never add historical
 // identities to active choices or infer directory authority from a record.
 function addHistorical(rows:readonly WorkshopReference[]){
  for(const row of rows){
   if(!isWorkshopId(row.id)||!(row.label===null||typeof row.label==="string"))throw new Error("Dữ liệu tham chiếu Workshop không hợp lệ.");
   if(tokenById.has(row.id))continue;
   const label=row.label?.trim()||null;
   let token=base(label);
   if(label===null||idByToken.has(token))token+=" · "+row.id.slice(-8);
   if(idByToken.has(token))token=base(label)+" · "+row.id;
   while(idByToken.has(token))token+=" ·";
   tokenById.set(row.id,token);idByToken.set(token,row.id);
  }
 }
 return {options,display,resolve,resolveMany,addHistorical};
}
