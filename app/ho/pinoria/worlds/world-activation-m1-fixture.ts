/** PAP-2143 / PNR-WORLD — local M1 activation fixture; no live transport. */
export const WORLD_M1_ROUTE="/ho/pinoria/worlds";
export const WORLD_M1_MARKER="WORLD-MOCK-001";
export const WORLD_M1_ID="019a0000-0000-7000-8000-000000000031";
const sceneId="019a0000-0000-7000-8000-000000000032";
const mediaId="019a0000-0000-7000-8000-000000000033";
const at="2026-11-27T08:00:00.000Z",root="/api/ho/pinoria/worlds";
const asset="pinoria/world/uploads/"+"a".repeat(64);
function seed(hasScene:boolean){
 return {id:WORLD_M1_ID,key:"world-mock",displayName:"World mô phỏng",descriptionText:"Dữ liệu M1, không lưu hệ thống",worldType:"OTHER",status:"DRAFT",version:1,createdAt:at,updatedAt:at,createdByUser:"M1",updatedByUser:"M1",
 scenes:hasScene?[{id:sceneId,worldId:WORLD_M1_ID,key:"scene-mock",displayName:"Cảnh mô phỏng",descriptionText:"",status:"ACTIVE",sortOrder:0,canvasWidth:1280,canvasHeight:720,baseAssetKey:asset+".png",version:1,layers:[
 {id:sceneId,key:"character",displayName:"Character",kind:"CHARACTER",version:1,mediaType:null,assetKey:null,posterAssetKey:null,positionX:0,positionY:26,scale:1,zIndex:0,anchor:"BOTTOM_CENTER",enabled:true,metadata:{}},
 {id:mediaId,key:"mock-gif",displayName:"Mock GIF",kind:"MEDIA",version:1,mediaType:"GIF",assetKey:asset+".gif",posterAssetKey:null,positionX:0,positionY:0,scale:1,zIndex:1,anchor:"CENTER",enabled:true,metadata:{}}
 ]}]:[]};
}
const error=(status:number)=>Response.json({error:{code:"M1_LOCAL_ONLY"}},{status});
export function createWorldActivationFixture({hasScene=true,canManage=true}:{hasScene?:boolean;canManage?:boolean}={}){
 let current=seed(hasScene);
 const events=[{id:"019a0000-0000-7000-8000-000000000034",occurredAt:at,action:"PINORIA_WORLD_CREATED",subjectType:"pinoria_world",actorName:"M1"}];
 const transport:typeof fetch=async(input,init)=>{
  if(init?.signal?.aborted)throw new DOMException("Aborted","AbortError");
  if(typeof input!=="string")return error(404);
  const method=init?.method??"GET";
  if(method==="GET"&&input===root)return Response.json({data:{worlds:[current]}});
  if(method==="GET"&&input===root+"/"+WORLD_M1_ID+"/history")return Response.json({data:{events,truncated:false}});
  if(method!=="PATCH"||input!==root+"/"+WORLD_M1_ID)return error(404);
  if(!canManage)return error(403);
  if(typeof init?.body!=="string")return error(400);
  let body:unknown;try{body=JSON.parse(init.body)}catch{return error(400)}
  if(!body||typeof body!=="object"||Array.isArray(body))return error(400);
  const value=body as Record<string,unknown>;
  if(Object.keys(value).sort().join(",")!=="expectedVersion,status"||value.status!=="ACTIVE"||!Number.isSafeInteger(value.expectedVersion))return error(400);
  if(current.status!=="DRAFT"||value.expectedVersion!==current.version)return error(409);
  if(!current.scenes.some(s=>s.status==="ACTIVE"))return error(400);
  current={...current,status:"ACTIVE",version:current.version+1};
  events.unshift({id:"019a0000-0000-7000-8000-000000000035",occurredAt:at,action:"PINORIA_WORLD_UPDATED",subjectType:"pinoria_world",actorName:"M1"});
  return Response.json({data:current});
 };
 return transport;
}
