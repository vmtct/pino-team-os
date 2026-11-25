/** PAP-2371: same approved TDD definition, real authorized data only. */
import {TddRegistry,type ModuleSchema,type AuthorizationContext} from "@/lib/workspace-schema";
import {spaceDefinition,SPACE_READ,type SpaceSchemaFields} from "./schema";
import {createLearningSpaceClient,loadLearningSpaceDirectory,SpaceApiError,type SpaceClass} from "./learning-space-client";
import {projectLiveSpace} from "./learning-space-provider";
const allowed=(c:AuthorizationContext)=>c.surface==="HO"&&c.authorize(SPACE_READ);
type Client=ReturnType<typeof createLearningSpaceClient>;
export function createLiveSpaceSchema(client:Client){
 const registry=new TddRegistry();
 const definition:ModuleSchema<SpaceSchemaFields>={...spaceDefinition,
  capabilities:{...spaceDefinition.capabilities,history:SPACE_READ},
  data:{id:"learning-space-core",list:async(_query,context,signal)=>{if(!allowed(context))throw Error("Denied");const rows=(await loadLearningSpaceDirectory(client,signal)).map(projectLiveSpace);return {rows,total:rows.length};},detail:async(id,context,signal)=>{if(!allowed(context))throw Error("Denied");try{return projectLiveSpace(await client.detail(id,signal));}catch(e){if(e instanceof SpaceApiError&&e.status===404)return null;throw e;}}},
  detail:{...spaceDefinition.detail,businessTabs:spaceDefinition.detail.businessTabs.map(tab=>({...tab,source:{adapter:"learning-space-core-classes",permission:SPACE_READ}})),history:{kind:"provider",source:{adapter:"learning-space-core-history",permission:SPACE_READ},load:async(subject,context,cursor,signal)=>{
   if(!allowed(context)||subject.type!=="learning_space")return {status:"denied"};
   const p=await client.history(subject.id,cursor,signal);
   return {status:"authorized",nextCursor:p.nextAfter,events:p.items.map(e=>({id:e.id,at:e.occurredAt,actor:e.actorName??"—",action:e.action,outcome:"succeeded",source:"Core",subject,redacted:true}))};
  }}}
 };
 return {registry,schema:registry.register(definition)};
}
export async function loadSpaceClassRows(client:Pick<Client,"detail"|"classes">,id:string,signal:AbortSignal){
 const parent=await client.detail(id,signal),items:SpaceClass[]=[];let after:string|null=null;
 for(let i=0;i<100;i++){
  signal.throwIfAborted();const p=await client.classes(id,after,signal);
  if(p.items.some(r=>r.centerId!==parent.centerId||after!==null&&r.id<=after))throw Error("Class scope mismatch");
  items.push(...p.items);
  if(p.nextAfter===null)return items.map(r=>({id:r.id,name:r.displayName,center:parent.centerName,status:r.status}));
  if(p.nextAfter!==p.items.at(-1)?.id)throw Error("Class pagination mismatch");
  after=p.nextAfter;
 }
 throw Error("Class directory exceeds safe bound");
}
