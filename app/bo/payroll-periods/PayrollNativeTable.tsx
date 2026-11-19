"use client";
/** PAP-2154: reuse native PINO table. Core owns fixed-size server paging. */
import {useState,type ReactNode} from 'react';
import {BoTableSettings} from '@/app/bo/components/registration/BoTableSettings';
import {BoDataTable} from "@/app/bo/components/registration/BoDataTable";
import {defaultTable,type BoModule,type BoRecord,type BoField,type BoTableState} from "@/lib/bo-registration";
import type {TablePolicy} from "@/app/components/workspace-renderer/TablePolicy";
const policy:TablePolicy={identity:"name",search:[],filter:[],sort:[],group:[],edit:[],viewActions:[]};
export function payrollPresentation<T extends {id:string}>(label:string,identityLabel:string,name:(row:T)=>string,properties:readonly [string,(row:T)=>string][]){
 const items=properties.filter(([label])=>label!==identityLabel);
 const fields:BoField[]=[{key:"name",label:identityLabel,type:"text",icon:"Aa",w:220,readonly:true},
  ...items.map(([label],i):BoField=>({key:"field"+i,label,type:label==="Trạng thái"?"select":"text",icon:label==="Trạng thái"?"◉":"Aa",w:label==="Lý do yêu cầu"?220:145,readonly:true}))];
 const presentationModule:BoModule={label,group:"Workforce",fields};
 const record=(row:T):BoRecord=>({id:row.id,name:name(row),...Object.fromEntries(items.map(([,render],i)=>["field"+i,render(row)]))});
 return {module:presentationModule,record};
}
export function PayrollNativeTable({module,rows,loadState,onOpen,selected,page=1,total,onPageChange}:{module:BoModule;rows:BoRecord[];loadState:string;onOpen?:(row:BoRecord)=>void;selected?:string|null;page?:number;total?:number;onPageChange?:(page:number)=>void}){
 const value={...defaultTable(module.fields),pageSize:50};
 const count=total??rows.length;
 return <>
  <BoDataTable module={module} rows={rows} loadState={loadState} value={value} update={()=>{}} page={page}
   setPage={onPageChange??(()=>{})} onOpen={onOpen??(()=>{})} openEnabled={!!onOpen} selected={selected??undefined}
   onSettings={()=>{}} filterOpen={false} setFilterOpen={()=>{}} views={[]} changeViews={()=>{}} activeView={null}
   applyView={()=>{}} reset={()=>{}} undo={()=>{}} canUndo={false} minimal showChrome={false}
   policy={policy} serverTotal={count} totalKnown={false}/>
  {onPageChange?<footer className="table-footer"><span className="result-label">{count} bản ghi</span><div className="pagination">
   <span className="page-counter">{rows.length?(page-1)*50+1:0}–{rows.length?Math.min(count,(page-1)*50+rows.length):0} / {count}</span>
   <button type="button" className="pager" aria-label="Trang trước" disabled={page<=1} onClick={()=>onPageChange(page-1)}>‹</button>
   <button type="button" className="pager" aria-label="Trang sau" disabled={page*50>=count} onClick={()=>onPageChange(page+1)}>›</button>
  </div></footer>:null}
 </>;
}
/** Daily/Exception server-paged native DSA. Server filters and page size remain authoritative. */
export function PayrollDsaReadTable({module,rows,loadState,onOpen,selected,page,total,pageSize,onPageChange,onPageSizeChange,filterContent,onReset}:{module:BoModule;rows:BoRecord[];loadState:string;onOpen:(row:BoRecord)=>void;selected:string|null;page:number;total:number;pageSize:number;onPageChange:(page:number)=>void;onPageSizeChange:(size:number)=>void;filterContent:ReactNode;onReset:()=>void}){
 const [state,setState]=useState<BoTableState>(()=>defaultTable(module.fields));
 const [settings,setSettings]=useState<string|null>(null);
 const [filterOpen,setFilterOpen]=useState(false);
 const value={...state,pageSize};
 const update=(patch:Partial<BoTableState>)=>{
  if(patch.pageSize!==undefined && [8,15,30].includes(patch.pageSize))onPageSizeChange(patch.pageSize);
  setState(old=>({...old,...patch}));
 };
 const reset=()=>{setState(defaultTable(module.fields));onPageSizeChange(15);onReset();setFilterOpen(false);};
 return <div data-tdd-shell="table" data-tdd-freeze-controls="" data-tdd-surface="BO">
  <BoDataTable module={module} rows={rows} loadState={loadState} value={value} update={update}
   page={page} setPage={onPageChange} onOpen={onOpen} selected={selected??undefined}
   onSettings={setSettings} filterOpen={filterOpen} filterContent={filterContent} setFilterOpen={setFilterOpen}
   views={[]} changeViews={()=>{}} activeView={null} applyView={()=>{}} reset={reset} undo={()=>{}} canUndo={false}
   policy={policy} serverTotal={total} totalKnown minimal freezeEnabled/>
  {settings?<BoTableSettings screen={settings} setScreen={setSettings} onClose={()=>setSettings(null)}
   fields={module.fields} rows={rows} value={value} update={update} views={[]} setViews={()=>{}} applyView={()=>{}} policy={policy}/>:null}
 </div>;
}