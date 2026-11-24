"use client";
// PAP-2192 / PLT-ACCESS — native TDD presentation; no live role commands.
import { useId, useMemo, useState } from "react";
import { TddRegistry, type AuthorizationContext, type FieldSchema, type ModuleRow, type TableQuery, type TddActionBindings, type MutationAdapter } from "@/lib/workspace-schema";
import { TddRenderer } from "@/app/components/workspace-renderer/Renderer";
import { TddPreferencePolicy } from "@/app/components/workspace-renderer/Record";
import { HoWorkspace } from "@/app/ho/HoWorkspace";
import { TosButton, TosCard } from "@pino/design-system/react";
import { createPreviewState, reducePreview } from "@/lib/m1-preview/state";
import type { BoAccessPermission } from "@/lib/bo-access-model";
import { roleDefinition, roleFields, roleQuery, verifyRolePermissionTabApproval } from "./schema";
import { CreateCustomRoleFields } from "./RoleLifecycleForms";
import { matchesPlatform, type PlatformFilter } from "./HoRoleEditor";
import { roleM1, makePreviewRole, archivePreviewRole, eligiblePermissions, rolePreviewCatalog, canEditPreviewRole, previewRoleVersion, editPreviewRole, type PreviewRole } from "./role-m1-preview";
import type { RoleDraft } from "./role-lifecycle-model";

const [roleName,roleType,roleStatus,permissionCount,assignmentCount,roleKey,descriptionField,...auditFields] = roleFields;
const fields = [{...roleName,readOnly:false,required:true,validation:{minLength:1,maxLength:120},capabilities:{...roleName.capabilities,inlineEdit:true}},
  roleType,roleStatus,permissionCount,assignmentCount,roleKey,
  {...descriptionField,readOnly:false,capabilities:{...descriptionField.capabilities,inlineEdit:true}},...auditFields] as const satisfies readonly FieldSchema[];
type F = typeof fields;
const registry = new TddRegistry(verifyRolePermissionTabApproval);
const schema = registry.register<F>({...roleDefinition,fields,capabilities:{...roleDefinition.capabilities,edit:"access.role.edit"},table:{...roleDefinition.table,inlineEdit:{enabled:true,fields:["name","description"]}},data:{id:"pap2192-preview-only",list:async()=>({rows:[],total:0}),detail:async()=>null}});
const initialQuery:TableQuery<F> = {...roleQuery,order:[...roleQuery.order],visible:[...roleQuery.visible]};
const emptyDraft=():RoleDraft=>({roleKey:"",displayName:"",description:""});
function project(role:PreviewRole):ModuleRow<F>{return {...role,createdBy:"—",updatedBy:"—",permissionCount:role.permissionKeys.length};}
function PermissionPicker({catalog,selected,onChange,disabled=false}:{catalog:BoAccessPermission[];selected:string[];onChange:(keys:string[])=>void;disabled?:boolean}){
  const [search,setSearch]=useState("");
  const [platform,setPlatform]=useState<PlatformFilter>("all");
  const [expanded,setExpanded]=useState<Record<string,boolean>>({});
  const searchId=useId();
  const platforms=(["all","BO","TOS"] as const).filter(value=>value==="all"||catalog.some(p=>matchesPlatform(p,value)));
  const groups=useMemo(()=>{
    const result=new Map<string,BoAccessPermission[]>();
    for(const permission of catalog){
      if(!matchesPlatform(permission,platform)||!(permission.key+" "+permission.displayLabel+" "+permission.domain).toLocaleLowerCase("vi").includes(search.toLocaleLowerCase("vi")))continue;
      result.set(permission.domain,[...(result.get(permission.domain)??[]),permission]);
    }
    return [...result.entries()].sort(([a],[b])=>a.localeCompare(b));
  },[catalog,search,platform]);
  return <div className="ho-role-editor"><TosCard className="ho-role-card ho-role-permission-card"><section aria-label="Quyền truy cập">
    <div className="ho-role-permission-header"><div><h3>Quyền truy cập</h3><p>Chọn quyền theo nhóm nghiệp vụ</p></div><div className="ho-role-metrics" aria-live="polite"><strong>{selected.length} / {catalog.length} quyền</strong></div></div>
    <div className="ho-role-platforms" role="group" aria-label="Lọc quyền theo nền tảng"><span className="ho-role-platforms-label">Nền tảng</span><div className="ho-role-platform-chips">{platforms.map(value=><button type="button" key={value} aria-pressed={value===platform} onClick={()=>setPlatform(value)}><span>{value==="all"?"Tất cả":value}</span><strong>{catalog.filter(p=>matchesPlatform(p,value)).length}</strong></button>)}</div></div>
    <div className="ho-role-controls"><label className="ho-role-search" htmlFor={searchId}>Tìm kiếm quyền<input id={searchId} type="search" placeholder="Tên quyền hoặc permission key" value={search} onChange={e=>setSearch(e.target.value)}/></label></div>
    <div className="ho-role-groups">{groups.map(([domain,permissions])=>{
      const open=expanded[domain]??Boolean(search);
      return <div className="ho-role-group" key={domain}><div className="ho-role-group-head"><strong className="ho-role-group-title">{domain}</strong><span className="ho-role-group-count">{permissions.filter(p=>selected.includes(p.key)).length}/{permissions.length} quyền</span><button type="button" className="ho-role-group-expand" aria-expanded={open} aria-label={(open?"Thu gọn nhóm ":"Mở rộng nhóm ")+domain} onClick={()=>setExpanded(prev=>({...prev,[domain]:!open}))}><span aria-hidden="true">{open?"⌄":"›"}</span></button></div>
      {open&&<fieldset disabled={disabled}><legend className="ho-role-legend">{domain}</legend>{permissions.map(p=><label className="ho-role-permission-row" key={p.key}><input type="checkbox" checked={selected.includes(p.key)} onChange={()=>onChange(selected.includes(p.key)?selected.filter(k=>k!==p.key):[...selected,p.key])}/><span className="ho-role-permission-info"><strong>{p.displayLabel}</strong><small>{p.key} · {p.allowedScopes.join("/")}</small></span></label>)}</fieldset>}</div>;
    })}{!groups.length&&<p className="ho-role-empty" role="status">Không có quyền khớp tìm kiếm.</p>}</div>
  </section></TosCard></div>;
}
/** The same typed view is mounted by authenticated Staging and the local synthetic-only host. */
export function RoleM1Content({scopeKey,permissionKeys}:{scopeKey:string;permissionKeys:string[]}){
  const context=useMemo<AuthorizationContext>(()=>({surface:"HO",authorize:key=>permissionKeys.includes(key)}),[permissionKeys]);
  const [state,setState]=useState(()=>createPreviewState(roleM1,scopeKey));
  const [query,setQuery]=useState(initialQuery);
  const [selected,setSelected]=useState<string|null>(null),[full,setFull]=useState(false);
  const [create,setCreate]=useState(false),[draft,setDraft]=useState(emptyDraft),[keys,setKeys]=useState<string[]>([]);
  const catalog=rolePreviewCatalog;
  const [confirm,setConfirm]=useState(false);
  const row=state.records.find(r=>r.id===selected);
  const candidate=makePreviewRole(draft,keys,catalog);
  const canEdit=context.authorize("access.role.edit");
  const adapter=useMemo<MutationAdapter<F>>(()=>({update:async(id,patch,expectedVersion,authorization,signal)=>{
    signal.throwIfAborted();
    if(authorization.surface!=="HO"||!authorization.authorize("access.role.view")||!authorization.authorize("access.role.edit"))return {status:"denied"};
    const current=state.records.find(r=>r.id===id);
    if(!current||!canEditPreviewRole(current))return {status:"denied"};
    if(previewRoleVersion(current)!==expectedVersion)return {status:"conflict"};
    const next=editPreviewRole(current,patch);
    if(!next)return {status:"invalid",fields:["name","description"]};
    return {status:"saved",row:project(next),version:previewRoleVersion(next)};
  }}),[state.records]);
  const onSaved=(record:ModuleRow<F>)=>{
    const original=state.records.find(r=>r.id===record.id);
    if(!original)return;
    setState(prev=>{
      const current=prev.records.find(r=>r.id===record.id);
      if(!current||previewRoleVersion(current)!==previewRoleVersion(original))return prev;
      const next=editPreviewRole(current,{name:record.name,description:record.description});
      return next?reducePreview(prev,{type:"replace",id:current.id,record:next}):prev;
    });
  };
  const versionForRow=(id:string)=>{
    const current=state.records.find(r=>r.id===id);
    return current&&canEditPreviewRole(current)?previewRoleVersion(current):"";
  };
  const tableWrites=canEdit?{adapter,versionForRow,onSaved}:undefined;
  const recordWrites=row&&canEdit&&canEditPreviewRole(row)?{adapter,version:previewRoleVersion(row),onSaved}:undefined;
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
    {row&&full?<TddRenderer view={{kind:"detail",props:{...common,record:project(row),writes:recordWrites,subject:{type:"access_role",id:row.id},onBack:close,
      renderApprovedExtension:(_record,_context,tab)=>tab==="permissions"?<PermissionPicker catalog={eligiblePermissions(catalog)} selected={row.permissionKeys} disabled={row.status!=="active"} onChange={permissionKeys=>setState(prev=>reducePreview(prev,{type:"replace",id:row.id,record:{...row,permissionKeys}}))}/>:null,
      overviewAfter:<TosCard className="ho-role-card"><TosButton variant="secondary" disabled={!archivePreviewRole(row)} onClick={()=>setConfirm(true)}>Lưu trữ vai trò</TosButton>{confirm&&<div role="alertdialog" aria-label="Xác nhận lưu trữ"><p>Lưu trữ {row.name}?</p><TosButton variant="secondary" onClick={()=>setConfirm(false)}>Hủy</TosButton><TosButton variant="primary" onClick={()=>{const archived=archivePreviewRole(row);if(archived)setState(prev=>reducePreview(prev,{type:"replace",id:row.id,record:archived}));setConfirm(false);}}>Xác nhận lưu trữ</TosButton></div>}</TosCard>}}}/>:
      <TddRenderer view={{kind:"table",props:{...common,query,rows:state.records.map(project),total:state.records.length,status:"ready",writes:tableWrites,actionBindings:bindings,onQueryChange:setQuery,onOpen:r=>{setSelected(r.id);setFull(false);}}}}/>}
    {row&&!full&&<TddRenderer view={{kind:"drawer",props:{...common,record:project(row),writes:recordWrites,onClose:close,onDetail:()=>setFull(true)}}}/>}
    {create&&<TddRenderer view={{kind:"form",props:{...common,mode:"create",title:"Tạo vai trò",onClose:()=>setCreate(false),actionBindings:bindings,content:<div className="ho-role-editor"><CreateCustomRoleFields draft={draft} onChange={setDraft}/><PermissionPicker catalog={eligiblePermissions(catalog)} selected={keys} onChange={setKeys}/></div>}}}/>}
  </TddPreferencePolicy.Provider>;
  return content;
}

export function RoleM1Preview(props:{scopeKey:string;permissionKeys:string[]}){
  return <HoWorkspace module="roles" content={<RoleM1Content scopeKey={props.scopeKey} permissionKeys={props.permissionKeys}/>}/>;
}
