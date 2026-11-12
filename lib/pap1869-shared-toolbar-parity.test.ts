/** PAP-1869 / Epic PAP-1676 MISSION ASSIGNMENT, global keeper PAP-1867. */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { BoViewTabs } from "../app/bo/components/registration/BoViewTabs";
import { BoDataTable } from "../app/bo/components/registration/BoDataTable";
import { defaultTable, type BoModule } from "./bo-registration";
const file=(f:string)=>readFileSync(f,"utf8");
const noop=()=>{};
const moduleConfig:BoModule={label:"PINO Mission",group:"PINO",fields:[
 {key:"name",label:"Student",type:"text",icon:"Aa",w:190},
 {key:"status",label:"Trạng thái",type:"text",icon:"Aa",w:140},
]};
const views=[{id:"mine",name:"Đang giao",state:defaultTable(moduleConfig.fields)}];
test("PAP-1869 canonical native quick views are ARIA tabs with correct selected state",()=>{
 const html=renderToStaticMarkup(createElement(BoViewTabs,{views,changeViews:noop,active:null,apply:noop,onAdd:noop,
   builtIn:createElement("button",{type:"button",role:"tab","aria-selected":false,"aria-controls":"table-scroll",tabIndex:-1,className:"view-tab"},"Hoàn tất"),
   actions:["apply"],minimal:true}));
 assert.match(html,/class="tabs-left" role="tablist" aria-label="Chế độ xem bảng"/);
 assert.match(html,/role="tab" aria-selected="true" aria-controls="table-scroll" tabindex="0"[^>]*data-view="all"/);
 assert.match(html,/role="tab" aria-selected="false" aria-controls="table-scroll" tabindex="-1"[^>]*>Hoàn tất/);
 assert.match(html,/role="tab" aria-selected="false" aria-controls="table-scroll" tabindex="-1"[^>]*>▤ Đang giao/);
 assert.doesNotMatch(html,/aria-selected="true"[^>]*>Hoàn tất/);
 const active=renderToStaticMarkup(createElement(BoViewTabs,{views,changeViews:noop,active:"mine",apply:noop,onAdd:noop,actions:["apply"],minimal:true}));
 assert.match(active,/role="tab" aria-selected="false"[^>]*data-view="all"/);
 assert.match(active,/role="tab" aria-selected="true" aria-controls="table-scroll" tabindex="0"[^>]*>▤ Đang giao/);
});
test("PAP-1869 filter popup remains native, source owned dismiss and no layout clone",()=>{
 const html=renderToStaticMarkup(createElement(BoDataTable,{
  module:moduleConfig,rows:[{id:"student",name:"Nguyễn An",status:"ASSIGNED"}],
  loadState:"ready",value:defaultTable(moduleConfig.fields),update:noop,page:1,setPage:noop,
  onOpen:noop,onSettings:noop,filterOpen:true,setFilterOpen:noop,views:[],changeViews:noop,
  activeView:null,applyView:noop,reset:noop,undo:noop,canUndo:false,
 }));
 assert.match(html,/id="filter-toggle"[^>]*aria-expanded="true"/);
 assert.match(html,/data-tdd-filter-surface=""/);
 assert.match(html,/id="rules-panel"/);
 assert.match(html,/id="visible-columns"/);
 assert.match(html,/id="reset-all"/);
 const source=file("app/bo/components/registration/BoDataTable.tsx");
 assert.match(source,/document.addEventListener\("keydown", onEscape\)/);
 assert.match(source,/document.removeEventListener\("keydown", onEscape\)/);
 assert.match(source,/document.addEventListener\("pointerdown", onOutside\)/);
 assert.match(source,/document.removeEventListener\("pointerdown", onOutside\)/);
 assert.match(source,/filterSurfaceRef.current\?\.contains\(target\)/);
 assert.match(source,/filterButtonRef.current\?\.focus/);
 assert.doesNotMatch(source,/<select[^>]*id="filter-toggle"/);
 assert.doesNotMatch(file("app/components/workspace-renderer/tdd-table-geometry.css"),/\[data-tdd-filter-surface\]/, "Preserve canonical BO/HO CSS declarations; dismiss wrapper is not a CSS fork.");
});
test("PAP-1869 typed built-in views retain source Center authorization and unique selection",()=>{
 const source=file("app/components/workspace-renderer/Table.tsx");
 assert.match(source,/role="tab" aria-selected=\{active === view.id\}/);
 assert.match(source,/toLegacyTableState\(schema, view.state, context\)/);
 assert.match(source,/onQueryChange\(view.state\)/);
 const b=file("app/bo/components/registration/BoViewTabs.tsx");
 assert.match(b,/querySelectorAll<HTMLButtonElement>\('\[role="tab"\]:not\(:disabled\)'\)/);
 assert.match(b,/event.preventDefault\(\)/);
 assert.match(b,/enabled\[next\]\?\.click\(\)/);
});
