// PAP-1764 · one shared structure; independently selected active tab in each app.
import type { PinerAppKey } from "./catalog";
export type NavIcon="home"|"art"|"music"|"star"|"palette"|"video"|"community"|"grid";
export type NavItem={id:"home"|"grid"|"reels"|"community";label:string;icon:NavIcon};
const TABS:readonly NavItem[]=[
 {id:"home",label:"Bảng tin",icon:"home"},
 {id:"grid",label:"Bộ sưu tập",icon:"grid"},
 {id:"reels",label:"Reels",icon:"video"},
 {id:"community",label:"Cộng đồng",icon:"community"}
];
export const APP_NAV:Record<PinerAppKey,readonly NavItem[]>={ "hoi-hoa":TABS,piano:TABS };
export const getTabHref=(app:PinerAppKey,tab:string)=>tab==="home"?`/piner/${app}`:`/piner/${app}/${tab}`;
