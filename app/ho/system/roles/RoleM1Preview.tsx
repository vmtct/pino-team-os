"use client";
// PAP-2192 / PLT-ACCESS — native TDD presentation; no live role commands.
import { useEffect, useMemo, useState } from "react";
import { TddRegistry, type AuthorizationContext, type FieldSchema, type ModuleRow, type TableQuery, type TddActionBindings } from "@/lib/workspace-schema";
import { TddRenderer } from "@/app/components/workspace-renderer/Renderer";
import { TddPreferencePolicy } from "@/app/components/workspace-renderer/Record";
import { HoWorkspace } from "@/app/ho/HoWorkspace";
import { TosButton, TosCard } from "@pino/design-system/react";
import { createPreviewState, reducePreview } from "@/lib/m1-preview/state";
import type { BoAccessPermission } from "@/lib/bo-access-model";
import { roleDefinition, roleFields, roleQuery, verifyRolePermissionTabApproval } from "./schema";
import { CreateCustomRoleFields } from "./RoleLifecycleForms";
import { matchesPlatform, type PlatformFilter } from "./HoRoleEditor";
import { roleM1, makePreviewRole, archivePreviewRole, type PreviewRole } from "./role-m1-preview";
import type { RoleDraft } from "./role-lifecycle-model";

const read = {display:true,search:false,filter:false,sort:false,group:false,inlineEdit:false} as const;
const extra = [
  {key:"description",label:"Mô tả",type:"text",icon:"Aa",width:220},
  {key:"createdAt",label:"Created Time",type:"datetime",icon:"◷",width:170},
  {key:"createdBy",label:"Created By",type:"text",icon:"@",width:150},
  {key:"updatedAt",label:"Last Modified Time",type:"datetime",icon:"◷",width:170},
  {key:"updatedBy",label:"Last Modified By",type:"text",icon:"@",width:150},
] as const;
const fields = [...roleFields, ...extra.map(field=>({...field,permission:"access.role.view",readOnly:true,capabilities:read} as const))] as const satisfies readonly FieldSchema[];
type F = typeof fields;
const audit = ["createdAt","createdBy","updatedAt","updatedBy"] as const;
const sections = [{id:"role-info",label:"Thông tin Role",fields:["name","roleKey","description","roleType","status","permissionCount","assignmentCount"]},{id:"audit",label:"Thông tin hệ thống",fields:audit}] as const;
const registry = new TddRegistry(verifyRolePermissionTabApproval);
const schema = registry.register<F>({...roleDefinition,fields,table:{...roleDefinition.table,columns:[...roleDefinition.table.columns,...extra.map(field=>({field:field.key,visible:field.key!=="description"}))]},drawer:{...roleDefinition.drawer,sections},detail:{...roleDefinition.detail,overview:{sections}},data:{id:"pap2192-preview-only",list:async()=>({rows:[],total:0}),detail:async()=>null}});
const initialQuery:TableQuery<F> = {...roleQuery,order:[...roleQuery.order,"description",...audit],visible:[...roleQuery.visible,...audit]};
const emptyDraft=():RoleDraft=>({roleKey:"",displayName:"",description:""});
function project(role:PreviewRole):ModuleRow<F>{return {...role,permissionCount:role.permissionKeys.length};}
function PermissionPicker({catalog,selected,onChange,disabled=false}:{catalog:BoAccessPermission[];selected:string[];onChange:(keys:string[])=>void;disabled?:boolean}){
  const [search,setSearch]=useState("");
  const [platform,setPlatform]=useState<PlatformFilter>("all");
  const groups=useMemo(()=>{
    const result=new Map<string,BoAccessPermission[]>();
    for(const permission of catalog){
      if(!matchesPlatform(permission,platform)||!(permission.key+" "+permission.displayLabel+" "+permission.domain).toLocaleLowerCase("vi").includes(search.toLocaleLowerCase("vi")))continue;
      result.set(permission.domain,[...(result.get(permission.domain)??[]),permission]);
    }
    return [...result.entries()].sort(([a],[b])=>a.localeCompare(b));
  },[catalog,search,platform]);
  return <div className="ho-role-editor"><TosCard className="ho-role-card ho-role-permission-card"><section aria-label="Quyền truy cập">
    <h3>Quyền truy cập · {selected.length} đã chọn</h3>
    <div className="ho-role-platform-chips">{(["all","HO","BO","TOS"] as const).map(value=><button type="button" key={value} aria-pressed={value===platform} onClick={()=>setPlatform(value)}>{value==="all"?"Tất cả":value}</button>)}</div>
    <label className="ho-role-search">Tìm kiếm quyền<input type="search" value={search} onChange={e=>setSearch(e.target.value)}/></label>
    {groups.map(([domain,permissions])=><details key={domain} className="ho-role-group" open={!!search||undefined}><summary>{domain} · {permissions.filter(p=>selected.includes(p.key)).length}/{permissions.length}</summary>
      <fieldset disabled={disabled}><legend>{domain}</legend>{permissions.map(p=><label className="ho-role-permission-row" key={p.key}><input type="checkbox" checked={selected.includes(p.key)} onChange={()=>onChange(selected.includes(p.key)?selected.filter(k=>k!==p.key):[...selected,p.key])}/><span className="ho-role-permission-info"><strong>{p.displayLabel}</strong><small>{p.key}</small></span></label>)}</fieldset>
    </details>)}
    {!groups.length&&<p role="status">Không có quyền khớp.</p>}
  </section></TosCard></div>;
}
export function RoleM1Preview({scopeKey,permissionKeys}:{scopeKey:string;permissionKeys:string[]}){
  const context=useMemo<AuthorizationContext>(()=>({surface:"HO",authorize:key=>permissionKeys.includes(key)}),[permissionKeys]);
  const [state,setState]=useState(()=>createPreviewState(roleM1,scopeKey));
  const [query,setQuery]=useState(initialQuery);
  const [selected,setSelected]=useState<string|null>(null),[full,setFull]=useState(false);
  const [create,setCreate]=useState(false),[draft,setDraft]=useState(emptyDraft),[keys,setKeys]=useState<string[]>([]);
  const [catalog,setCatalog]=useState<BoAccessPermission[]|null>(null),[error,setError]=useState(false),[confirm,setConfirm]=useState(false);
  useEffect(()=>{
    const abort=new AbortController();
    void fetch("/api/bo/access/permissions",{method:"GET",credentials:"same-origin",cache:"no-store",signal:abort.signal}).then(async response=>{
      if(!response.ok)throw Error("Catalog unavailable");
      const data=(await response.json()).data;
      if(!Array.isArray(data)||data.some(p=>!p||typeof p.key!=="string"||typeof p.domain!=="string"||typeof p.displayLabel!=="string"))throw Error("Invalid catalog");
      if(!abort.signal.aborted)setCatalog(data);
    }).catch(()=>{if(!abort.signal.aborted)setError(true);});
    return ()=>abort.abort();
  },[]);
  const row=state.records.find(r=>r.id===selected);
  const candidate=catalog&&makePreviewRole(draft,keys,catalog.map(p=>p.key));
  const bindings:TddActionBindings={
    openCreate:{kind:"navigation",run:()=>{setDraft(emptyDraft());setKeys([]);setCreate(true);}},
    cancelCreate:{kind:"navigation",run:()=>setCreate(false)},
    saveCreate:{kind:"mutation",disabled:!candidate||state.records.some(r=>r.roleKey===candidate.roleKey),run:()=>{
      if(!candidate||state.records.some(r=>r.roleKey===candidate.roleKey))return {state:"invalid"};
      setState(prev=>reducePreview<PreviewRole>(prev,{type:"create",record:candidate}));setCreate(false);return {state:"verified"};
    }}
  };
  const common={registry,schema,context};
  const close=()=>{setSelected(null);setFull(false);setConfirm(false);};
  const content=<TddPreferencePolicy.Provider value="ephemeral">
    <p role="status">M1 · Dữ liệu mô phỏng, không lưu vào hệ thống.</p>
    {row&&full?<TddRenderer view={{kind:"detail",props:{...common,record:project(row),subject:{type:"access_role",id:row.id},onBack:close,
      renderApprovedExtension:(_record,_context,tab)=>tab==="permissions"?<PermissionPicker catalog={catalog??[]} selected={row.permissionKeys} disabled={row.status!=="active"} onChange={permissionKeys=>setState(prev=>reducePreview(prev,{type:"replace",id:row.id,record:{...row,permissionKeys}}))}/>:null,
      overviewAfter:<TosCard className="ho-role-card"><TosButton variant="secondary" disabled={!archivePreviewRole(row)} onClick={()=>setConfirm(true)}>Lưu trữ vai trò</TosButton>{confirm&&<div role="alertdialog" aria-label="Xác nhận lưu trữ"><p>Lưu trữ {row.name}?</p><TosButton variant="secondary" onClick={()=>setConfirm(false)}>Hủy</TosButton><TosButton variant="primary" onClick={()=>{const archived=archivePreviewRole(row);if(archived)setState(prev=>reducePreview(prev,{type:"replace",id:row.id,record:archived}));setConfirm(false);}}>Xác nhận lưu trữ</TosButton></div>}</TosCard>}}}/>:
      <TddRenderer view={{kind:"table",props:{...common,query,rows:state.records.map(project),total:state.records.length,status:"ready",actionBindings:bindings,onQueryChange:setQuery,onOpen:r=>{setSelected(r.id);setFull(false);}}}}/>}
    {row&&!full&&<TddRenderer view={{kind:"drawer",props:{...common,record:project(row),onClose:close,onDetail:()=>setFull(true)}}}/>}
    {create&&<TddRenderer view={{kind:"form",props:{...common,mode:"create",title:"Tạo vai trò",onClose:()=>setCreate(false),actionBindings:bindings,content:<><CreateCustomRoleFields draft={draft} onChange={setDraft}/>{error?<p role="alert">Không tải được danh mục quyền.</p>:catalog?<PermissionPicker catalog={catalog} selected={keys} onChange={setKeys}/>:<p role="status">Đang tải danh mục quyền…</p>}</>}}}/>}
  </TddPreferencePolicy.Provider>;
  return <HoWorkspace module="roles" content={content}/>;
}
