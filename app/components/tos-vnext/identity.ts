/** Shared PAP-938 pure registry: safe to import from browser, Node test and Core adapter. */
export type TosVNextAppId="shift"|"reception"|"station"|"shift-lead"|"classroom"|"training";
export type TosVNextMode="mobile"|"desktop";
export const APP_ICON_BASE=process.env.NEXT_PUBLIC_TOS_ASSET_BASE??"https://pub-892fa79b018d4d2f9b0808189dd2ce46.r2.dev";
export const SIX_TOS_APPS=[
 {id:"shift",title:"Ca Làm",icon:"shift.png",mode:"mobile"},
 {id:"reception",title:"Tiếp Tân",icon:"frontdesk.png",mode:"mobile"},
 {id:"station",title:"Trạm TOS",icon:"tosStation.png",mode:"desktop"},
 {id:"shift-lead",title:"Trưởng Ca",icon:"shiftlead.png",mode:"mobile"},
 {id:"classroom",title:"Lớp Học",icon:"class.png",mode:"mobile"},
 {id:"training",title:"Thăng Tiến",icon:"training.png",mode:"mobile"}
] as const satisfies readonly {id:TosVNextAppId;title:string;icon:string;mode:TosVNextMode}[];
export const appIdentity=(app:TosVNextAppId)=>SIX_TOS_APPS.find(x=>x.id===app)!;
export const appIcon=(app:TosVNextAppId)=>APP_ICON_BASE+"/AppIcon/"+appIdentity(app).icon;
