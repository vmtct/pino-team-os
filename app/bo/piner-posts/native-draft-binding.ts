/** PAP-2134 / PNR-APP-HUB — native Draft runtime registration candidate.
 * Derives the approved M1 schema without duplicating its visual implementation.
 * No route admission, synthetic permission grant, or production runtime creation. */
import {TddRegistry,allows,type AuthorizationContext,type ModuleSchema,type MutationAdapter,type TableQuery} from "@/lib/workspace-schema";
import {postDefinition,postFields,postQuery} from "./schema";
import type {createDraftController} from "./draft-controller";
import {CoreDraftRequestError} from "./core-draft-client";
type Controller=ReturnType<typeof createDraftController>;
export const draftFields=postFields.map(f=>f.key==="caption"?{
 ...f,permission:"piner.post.view",readOnly:false,capabilities:{...f.capabilities,inlineEdit:true},validation:{maxLength:2000}
 } as const:{...f,permission:"piner.post.view"} as const);
export type DraftFields=typeof draftFields;
export const draftQuery:TableQuery<DraftFields>={...postQuery,filters:{logic:"AND",rules:[]}};
const controllers=new WeakMap<AuthorizationContext,Controller>();
function requireRead(ctx:AuthorizationContext):Controller {
 const controller=controllers.get(ctx);
 if(!controller||ctx.surface!=="BO"||ctx.centerId!==controller.centerId||!ctx.authorize("piner.post.view"))throw new CoreDraftRequestError(403);
 return controller;
}
export const draftRegistry=new TddRegistry();
const schema:ModuleSchema<DraftFields>={
  ...postDefinition,fields:draftFields,capabilities:{read:"piner.post.view",create:"piner.post.create",edit:"piner.post.edit"},
  table:{...postDefinition.table,views:{...postDefinition.table.views,builtIn:postDefinition.table.views.builtIn.filter(v=>v.id==="draft")}},
  detail:{overview:postDefinition.detail.overview,businessTabs:[],history:{kind:"unavailable",reason:"Chưa có lịch sử chi tiết."}},
  data:{id:"bo-private-post-draft",async list(_query,ctx,signal){
   const controller=requireRead(ctx);
   // Native local-ui paging operates only over the complete bounded authorized set.
   // Never expose a partially collected dataset as complete.
   const rows=[];let cursor:string|undefined;
   for(let n=0;n<100;n++){
    const page=await controller.list(signal,cursor);if(requireRead(ctx)!==controller)throw new CoreDraftRequestError(403);signal.throwIfAborted();
    rows.push(...page.rows);
    if(page.nextBeforeId===null)return {rows,total:rows.length};
    if(cursor&&page.nextBeforeId>=cursor)throw Error("Phân trang Post không tiến.");
    cursor=page.nextBeforeId;
   }
   throw Error("Danh sách vượt giới hạn. Cần phân trang phía Core.");
  },async detail(id,ctx,signal){const controller=requireRead(ctx);const row=await controller.detail(id,signal);if(requireRead(ctx)!==controller)throw new CoreDraftRequestError(403);return row;}},
 };
export const draftSchema=draftRegistry.register(schema);
export function bindNativeDraft(controller:Controller,context:AuthorizationContext){
 if(context.surface!=="BO"||context.centerId!==controller.centerId||controllers.has(context))throw new CoreDraftRequestError(403);
 controllers.set(context,controller);
 const permitted=(ctx:AuthorizationContext,permission:"piner.post.view"|"piner.post.create"|"piner.post.edit")=>ctx===context&&controllers.get(ctx)===controller&&ctx.surface==="BO"&&ctx.centerId===controller.centerId&&ctx.authorize("piner.post.view")&&ctx.authorize(permission);
 const mutation:MutationAdapter<DraftFields>={async update(id,patch,expectedVersion,ctx,signal){
  if(!permitted(ctx,"piner.post.edit")||!allows(draftSchema,ctx,"edit"))return {status:"denied"};
  const numeric=Number(expectedVersion);
  if(Object.keys(patch).length!==1||typeof patch.caption!=="string"||patch.caption.trim().length>2000||!/^\d+$/.test(expectedVersion)||!Number.isSafeInteger(numeric)||numeric<1)return {status:"invalid",fields:["caption"]};
  try{const row=await controller.editCaption(id,numeric,patch.caption,signal);signal.throwIfAborted();if(!permitted(ctx,"piner.post.edit"))return {status:"denied"};return {status:"saved",row,version:String(row.version)};}
  catch(e){if(e instanceof CoreDraftRequestError){if(e.status===409)return {status:"conflict"};if(e.status===401||e.status===403||e.status===404)return {status:"denied"};}throw e;}
 }};
 return {registry:draftRegistry,schema:draftSchema,mutation,context,canCreate:()=>permitted(context,"piner.post.create"),unbind(){if(controllers.get(context)===controller)controllers.delete(context);}};
}
