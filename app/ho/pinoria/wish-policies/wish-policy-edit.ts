/** PAP-2030 / PNR-WISH — draft editing only; Core remains CAS authority. */
import type {BoValue} from "@/lib/bo-registration";
import {savePolicyDraft,type PolicyValue,type WishConfigHead} from "@/lib/pls-wish-ho-contract";
export type PolicyEdit={base:Readonly<{recordId:string;pointerVersion:number;draftVersion:number;publishedId:string|null}>;name:string;centerId:string;cost:BoValue;rate3:BoValue;rate4:BoValue;rate5:BoValue;hard4:BoValue;hard5:BoValue;soft5:BoValue;featured:BoValue;media3:BoValue;media4:BoValue;media5:BoValue;curve:readonly {position:number;percentage:BoValue}[]};
const pct=(v:number)=>Number((v*100).toFixed(8));
export function policyEdit(head:WishConfigHead<PolicyValue>):PolicyEdit{
 const revision=head.pendingDraft??head.published;
 if(!revision||head.staleDraft)throw Error("Tải lại bản nháp Wish trước khi sửa.");
 const d=revision.value.definition;
 return {base:Object.freeze({recordId:head.recordId,pointerVersion:head.pointerVersion,draftVersion:head.latestDraft?.version??0,publishedId:head.published?.id??null}),name:revision.name,centerId:head.recordId,cost:revision.value.cost,rate3:pct(d.rates[0]),rate4:pct(d.rates[1]),rate5:pct(d.rates[2]),hard4:d.hard4,hard5:d.hard5,soft5:d.soft5,featured:d.featuredGuarantee,media3:d.media?.["3"]??"",media4:d.media?.["4"]??"",media5:d.media?.["5"]??"",curve:d.curve.map(x=>({position:x.position,percentage:pct(x.rate)}))};
}
const num=(v:BoValue)=>{if(typeof v!=="number"&&(typeof v!=="string"||!/^\d+(?:\.\d+)?$/.test(v.trim())))throw Error("Nhập số hợp lệ.");const n=Number(v);if(!Number.isFinite(n))throw Error("Nhập số hợp lệ.");return n;};
const clip=(v:BoValue)=>{if(v===null||v==="")return null;if(typeof v!=="string")throw Error("Media không hợp lệ.");return v.trim()||null;};
export function policyCurve(d:PolicyEdit){
 const soft=num(d.soft5),hard=num(d.hard5);
 if(!Number.isSafeInteger(soft)||!Number.isSafeInteger(hard)||soft<1||hard<=soft||hard-soft>500)throw Error("Khoảng soft/hard pity không hợp lệ.");
 return Array.from({length:hard-soft+1},(_,i)=>{const position=soft+i;return {position,percentage:d.curve.find(x=>x.position===position)?.percentage??(position===hard?100:"")};});
}
export function policyEditCurrent(d:PolicyEdit,head:WishConfigHead<PolicyValue>):boolean{
 return !head.staleDraft&&d.base.recordId===head.recordId&&d.base.pointerVersion===head.pointerVersion&&d.base.draftVersion===(head.latestDraft?.version??0)&&d.base.publishedId===(head.published?.id??null);
}
export function policyEditCommand(d:PolicyEdit,head:WishConfigHead<PolicyValue>){
 if(!policyEditCurrent(d,head))throw Error("Cấu hình đã thay đổi. Hủy bản nháp cục bộ và tải lại trước khi sửa.");
 if(head.staleDraft||d.centerId!==head.recordId||typeof d.featured!=="boolean")throw Error("Tải lại cấu hình Wish.");
 const rows=policyCurve(d);
 if(rows.length!==d.curve.length||rows.some((x,i)=>x.position!==d.curve[i]?.position))throw Error("Cập nhật đủ các bước soft pity.");
 return savePolicyDraft({centerId:d.centerId,cost:num(d.cost),definition:{rates:[num(d.rate3)/100,num(d.rate4)/100,num(d.rate5)/100],hard4:num(d.hard4),hard5:num(d.hard5),soft5:num(d.soft5),featuredGuarantee:d.featured,curve:d.curve.map(x=>({position:x.position,rate:num(x.percentage)/100})),media:{"3":clip(d.media3),"4":clip(d.media4),"5":clip(d.media5)}}},d.name,head);
}
