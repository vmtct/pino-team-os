/** PAP-2365 isolated native Product Plan fixture. No live transport or authentication. */
import {createRoot} from "react-dom/client";
import {ProductPlanNativeWorkspace} from "@/app/ho/billing/product-plans/ProductPlanNativeContent";
import {createProductPlanClient,catalogPath,type CatalogPort} from "@/app/ho/billing/product-plans/product-plan-native-contract";
import {createCatalogJournal} from "@/app/ho/billing/product-plans/product-plan-pending-journal";
import {BoRegistrationWorkspace,type BoWorkspaceSource} from "@/app/bo/components/registration/BoRegistrationWorkspace";
import {hoModules} from "@/lib/ho-system";
import "@pino/design-system/bo-tokens.css";
import "@pino/design-system/components.css";
import "../../public/ho-authority-source/ho-scoped.css";
import "../../app/components/workspace-renderer/tdd-detail-layout.css";
import "../../app/components/workspace-renderer/tdd-table-geometry.css";
import "../../app/components/workspace-renderer/tdd-freeze.css";
const id=(n:number)=>"01900000-0000-7000-8000-"+String(n).padStart(12,"0"),P=id(1),U=id(2),S=id(3),C=id(4),at="2026-11-26T00:00:00.000Z";
const params=new URLSearchParams(location.search),reader=params.has("reader"),lost=params.has("lost"),stale=params.has("stale");
const route="/ho/billing/product-plans";
const initial={id:P,displayName:"Gói QA Synthetic",createdByUserId:null,updatedByUserId:null as string|null,cadence:2,termWeeks:12,purchasedUnits:24,listPriceMinor:100000,currency:"VND",enabled:true,badge:"STANDARD",createdAt:at,updatedAt:at,version:1};
let row:typeof initial=JSON.parse(sessionStorage.getItem("qa-product-row")??JSON.stringify(initial)),writes=Number(sessionStorage.getItem("qa-product-writes")??0),reads=0;
const receipt=()=>{const out=document.getElementById("synthetic-receipt");if(out)out.textContent=JSON.stringify({row,writes,reads});};
const sub=(n:number)=>({id:id(n),studentProfileId:S,studentDisplayName:"QA Student "+n,centerId:C,centerDisplayName:"QA Center",lifecycle:"ACTIVE",contractualStartsOn:"2026-11-26",contractualEndsOn:"2027-02-18",createdAt:at,updatedAt:at,createdByUserId:null,updatedByUserId:null});
const port:CatalogPort=async(path,init)=>{
 init.signal.throwIfAborted();
 if(init.method==="GET"){
  reads++;receipt();
  if(path===catalogPath)return {status:200,data:[row]};
  if(path===catalogPath+"/"+P)return {status:200,data:row};
  const url=new URL(path,"https://fixture.invalid");
  if(url.pathname===catalogPath+"/"+P+"/subscriptions"){
   const after=url.searchParams.get("after");
   return {status:200,data:after?{items:[sub(125)],nextAfter:null}:{items:Array.from({length:25},(_,i)=>sub(100+i)),nextAfter:id(124)}};
  }
  if(url.pathname===catalogPath+"/"+P+"/history"){
   const event=(n:number)=>({id:id(n),occurredAt:at,actorId:U,action:"billing.product_plan_updated",previous:{displayName:initial.displayName},next:{displayName:row.displayName}});
   return {status:200,data:url.searchParams.has("after")?{items:[event(199)],nextAfter:null}:{items:Array.from({length:25},(_,i)=>event(224-i)),nextAfter:id(200)}};
  }
 }
 if(init.method==="PATCH"&&path===catalogPath+"/"+P&&!reader){
  const {expectedVersion,...changes}=init.body??{};
  if(stale&&row.version===1){row={...row,version:2,updatedByUserId:U};receipt();return {status:409,data:null};}
  if(expectedVersion!==row.version)return {status:409,data:null};
  if(changes.termWeeks!==undefined&&![12,24,48].includes(Number(changes.termWeeks)))return {status:422,data:null};
  row={...row,...changes,version:row.version+1,updatedByUserId:U};row.purchasedUnits=row.cadence*row.termWeeks;
  writes++;sessionStorage.setItem("qa-product-row",JSON.stringify(row));sessionStorage.setItem("qa-product-writes",String(writes));receipt();
  if(lost&&writes===1)throw Error("Synthetic lost ACK");
  return {status:200,data:row};
 }
 throw Error("Unexpected synthetic operation");
};
const client=createProductPlanClient(port,createCatalogJournal(sessionStorage,"qa-product-pending:"+U),U);
const source:BoWorkspaceSource={surface:"ho",readOnly:true,ephemeral:true,modules:hoModules,routeForModule:key=>key==="productPlans"?route:"#unavailable",scopeLabel:()=>"",load:async()=>{throw Error("No live transport");}};
createRoot(document.getElementById("root")!).render(<><output hidden id="synthetic-receipt"/><BoRegistrationWorkspace source={source} moduleKey="productPlans" currentUser={{displayName:"QA Synthetic"}} content={<ProductPlanNativeWorkspace client={client} permissionKeys={reader?["billing.view"]:["billing.view","billing.manage"]} initialRecord={params.has("record")?P:undefined}/>}/></>);
