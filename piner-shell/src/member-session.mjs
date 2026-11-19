// PAP-2194: Staging gateway projection from existing PIN BFF; never grants authority.
const PREFIX="/api/piner/afterschool/";
export async function readMemberChrome(request,service,route,now=Date.now()){
 if(!["GET","HEAD"].includes(request.method)||!route)return null;
 const site=request.headers.get("sec-fetch-site");
 if(site==="cross-site"||site==="same-site")return null;
 if(!(request.headers.get("cookie")??"").split(";").some(x=>x.trim().startsWith("__Host-PINO_AFTERSCHOOL=")))return null;
 if(typeof service?.fetch!=="function")throw Error("member_session_unavailable");
 async function read(path){
  const headers=new Headers({accept:"application/json"});
  for(const name of ["cookie","cf-connecting-ip","sec-fetch-site"]){const value=request.headers.get(name);if(value!==null)headers.set(name,value);}
  const r=await service.fetch(new Request(new URL(PREFIX+path,request.url),{method:"GET",headers,redirect:"manual"}));
  if(r.status!==200)throw Object.assign(Error("member_read_denied"),{status:r.status});
  return (await r.json())?.data;
 }
 try{
  const session=await read("session");
  if(session?.authenticated!==true||typeof session.expiresAt!=="string"||!Number.isFinite(Date.parse(session.expiresAt)))throw Error("member_session_unavailable");
  if(Date.parse(session.expiresAt)<=now)return null;
  if(request.method==="HEAD"||route.kind!=="member"||route.space!=="house")return {students:[],selectedId:null,runtime:true};
  const unavailable={students:[],selectedId:null,runtime:true,studentState:"error"};
  let data;try{data=await read("students");}catch(e){return [401,403,409].includes(e?.status)?null:unavailable;}
  if(!Array.isArray(data))return unavailable;
  const ids=new Set();const students=[];
  for(const row of data){
   if(typeof row?.id!=="string"||!row.id||typeof row.displayName!=="string"||!row.displayName.trim()||ids.has(row.id))return unavailable;
   ids.add(row.id);students.push({id:row.id,label:row.displayName});
  }
  return {students,selectedId:students.length===1?students[0].id:null,runtime:true};
 }catch(e){if([401,403,409].includes(e?.status))return null;throw Error("member_session_unavailable");}
}
