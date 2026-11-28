// PAP-2347 / PAP-2423. Local pinned Staff route state; no persistence or transport.
export const STAFF_LOCAL_RECORD="STAFF-MOCK-001";
export const staffLocalTabs=["overview","access","staff-rate","history"] as const;
export type StaffLocalTab=typeof staffLocalTabs[number];
export type StaffLocalRouteState={kind:"table"|"drawer"|"detail";recordId?:string;tab:StaffLocalTab};
export const isStaffLocalTab=(value:unknown):value is StaffLocalTab=>staffLocalTabs.some(tab=>tab===value);
export function parseStaffLocalRoute(params:URLSearchParams):StaffLocalRouteState|null{
 if([...params.keys()].some(k=>!["record","surface","tab"].includes(k))||["record","surface","tab"].some(k=>params.getAll(k).length>1))return null;
 const record=params.get("record"),surface=params.get("surface"),tab=params.get("tab");
 if(record===null)return surface===null&&tab===null?{kind:"table",tab:"overview"}:null;
 if(record!==STAFF_LOCAL_RECORD)return null;
 if(surface===null)return tab===null?{kind:"drawer",recordId:record,tab:"overview"}:null;
 if(surface!=="detail"||(tab!==null&&!isStaffLocalTab(tab)))return null;
 return {kind:"detail",recordId:record,tab:isStaffLocalTab(tab)?tab:"overview"};
}
export function staffLocalRouteSearch(next:{kind:"table"|"drawer"|"detail";recordId?:string;tab:string}):string{
 if(!isStaffLocalTab(next.tab))throw Error("Unknown Staff detail tab");
 // Other synthetic records exist only in the current in-memory session, never in the durable URL.
 if(next.kind==="table"||next.recordId!==STAFF_LOCAL_RECORD)return "";
 const params=new URLSearchParams({record:STAFF_LOCAL_RECORD});
 if(next.kind==="detail"){params.set("surface","detail");if(next.tab!=="overview")params.set("tab",next.tab);}
 return "?"+params.toString();
}
