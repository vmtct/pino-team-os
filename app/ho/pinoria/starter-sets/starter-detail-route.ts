/** PAP-1978: immutable, module-specific record/tab route, no draft state stored in URL. */
export const starterTabs=[{id:"overview",label:"Tổng quan"},{id:"members",label:"Thành viên"},{id:"history",label:"Lịch sử"}] as const;
export type StarterTab=typeof starterTabs[number]["id"];
export const isStarterTab=(value:string):value is StarterTab=>starterTabs.some(t=>t.id===value);
const recordId=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
export function readStarterDetailRoute(search:string){
 const p=new URLSearchParams(search),record=p.get("record"),raw=p.get("tab")??"overview";
 if(!record||!recordId.test(record)||p.getAll("record").length!==1||p.getAll("tab").length>1||!isStarterTab(raw))return null;
 return {record,tab:raw};
}
export function starterDetailUrl(href:string,record:string|null,tab:StarterTab="overview"){
 const u=new URL(href);u.searchParams.delete("record");u.searchParams.delete("tab");
 if(record){if(!recordId.test(record))throw Error("Invalid Starter record");u.searchParams.set("record",record);u.searchParams.set("tab",tab);}
 return u.pathname+u.search;
}
