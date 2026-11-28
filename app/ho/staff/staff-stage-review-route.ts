/** PAP-2423 / WFM-STAFF: exact review navigation only, never authorization. */
import {parseStaffLocalRoute,staffLocalRouteSearch,type StaffLocalRouteState} from "./staff-local-route-state";
import {STAFF_DIRECTORY_MOCK_ID} from "@/app/bo/workforce/staffs/staff-directory-m1-fixture";
export const STAFF_REVIEW_QUERY="staffReview";
export const STAFF_HO_REVIEW_ORIGIN="https://ho.staging.pinohouse.art";
export const STAFF_BO_REVIEW_ORIGIN="https://bo.staging.pinohouse.art";
export type StaffReviewEnv={APP_ENV?:string;BO_UI_ONLY?:string;STAFF_M1_REVIEW?:string};
export type StaffReviewSurface="HO"|"BO";
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const views=["all","active","deactivated","register"] as const;
type StaffReviewView=typeof views[number];
export type StaffStageReviewRoute={surface:"HO";state:StaffLocalRouteState}|{surface:"BO";centerId:string|null;view:StaffReviewView;recordId:string|null;kind:"table"|"drawer"|"detail"};
export function staffStageReviewEnabled(env:StaffReviewEnv,surface:StaffReviewSurface,host:string):boolean{
 return env.APP_ENV==="staging"&&env.STAFF_M1_REVIEW==="enabled"&&host===(surface==="HO"?"ho.staging.pinohouse.art":"bo.staging.pinohouse.art")&&(surface==="HO"||env.BO_UI_ONLY==="enabled");
}
export function staffStageQuery(query:Readonly<Record<string,string|string[]|undefined>>):URLSearchParams{
 const params=new URLSearchParams();for(const [key,value] of Object.entries(query)){if(typeof value==="string")params.append(key,value);else if(Array.isArray(value))for(const item of value)params.append(key,item);}
 return params;
}
export function parseStaffStageReview(url:URL):StaffStageReviewRoute|null{
 if(url.username||url.password||url.hash)return null;
 const q=new URLSearchParams(url.search);
 if(q.getAll(STAFF_REVIEW_QUERY).length!==1||q.get(STAFF_REVIEW_QUERY)!=="1"||[...q.keys()].some(k=>q.getAll(k).length!==1))return null;
 q.delete(STAFF_REVIEW_QUERY);
 if(url.origin===STAFF_HO_REVIEW_ORIGIN&&url.pathname==="/ho/staff"){
  const state=parseStaffLocalRoute(q);return state?{surface:"HO",state}:null;
 }
 if(url.origin!==STAFF_BO_REVIEW_ORIGIN||url.pathname!=="/bo/workforce/staffs"||[...q.keys()].some(k=>!["centerId","view","record","surface"].includes(k)))return null;
 const centerId=q.get("centerId"),view=q.get("view")??"all",recordId=q.get("record"),surface=q.get("surface");
 if(centerId===null)return q.size===0?{surface:"BO",centerId:null,view:"all",recordId:null,kind:"table"}:null;
 if(!uuid.test(centerId)||!views.some(v=>v===view)||(recordId!==null&&recordId!==STAFF_DIRECTORY_MOCK_ID)||(surface!==null&&(surface!=="detail"||recordId===null))||(recordId!==null&&view==="register"))return null;
 return {surface:"BO",centerId,view:view as StaffReviewView,recordId,kind:surface==="detail"?"detail":recordId?"drawer":"table"};
}
export function staffHoStageSearch(next:{kind:"table"|"drawer"|"detail";recordId?:string;tab:string}){
 const q=new URLSearchParams(staffLocalRouteSearch(next));q.set(STAFF_REVIEW_QUERY,"1");return "?"+q.toString();
}
/** Exact stage route only. Callers still need a real server authorization proof. */
export function staffStageReviewUrl(surface:StaffReviewSurface,params:URLSearchParams):URL|null{
 const url=new URL(surface==="HO"?"/ho/staff":"/bo/workforce/staffs",surface==="HO"?STAFF_HO_REVIEW_ORIGIN:STAFF_BO_REVIEW_ORIGIN);url.search=params.toString();return parseStaffStageReview(url)?url:null;
}
