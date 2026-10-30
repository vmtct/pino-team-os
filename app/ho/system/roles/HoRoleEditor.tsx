"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { PropertySections, TosCard, TosButton, type PropertyField } from "@pino/design-system/react";
import type { BoAccessPermission, BoAccessRoleDetail } from "@/lib/bo-access-model";
import { boApi } from "@/lib/bo-api";

type Ready = { role: BoAccessRoleDetail; permissions: BoAccessPermission[] };
type Draft = { displayName: string; description: string; keys: string[] };
const sorted = (keys: readonly string[]) => [...new Set(keys)].sort();
const same = (a: readonly string[], b: readonly string[]) => JSON.stringify(sorted(a)) === JSON.stringify(sorted(b));

async function loadRole(roleId: string, signal: AbortSignal): Promise<Ready> {
  const fetcher: typeof fetch = (input,init) => fetch(input,{...init,signal});
  const [role,permissionsResponse] = await Promise.all([
    boApi.accessRole(roleId,fetcher),
    fetcher("/api/bo/access/permissions",{method:"GET",cache:"no-store",credentials:"same-origin",redirect:"error"}),
  ]);
  signal.throwIfAborted();
  if (!permissionsResponse.ok) throw Error("Không thể tải danh mục quyền.");
  const payload: unknown = await permissionsResponse.json();
  if (!payload || typeof payload !== "object" || !("data" in payload) || !Array.isArray(payload.data))
    throw Error("Danh mục quyền không hợp lệ.");
  const permissions=payload.data as BoAccessPermission[];
  if (!Array.isArray(role.permissionKeys) || !role.permissionKeys.every(k=>typeof k==="string") ||
      !role.updatedAt || role.id!==roleId || permissions.some(p=>!p || typeof p.key!=="string" ||
      typeof p.domain!=="string" || typeof p.displayLabel!=="string"))
    throw Error("Chi tiết Role không hợp lệ.");
  return {role,permissions};
}
function fromRole(role:BoAccessRoleDetail):Draft {
  return {displayName:role.displayName,description:role.description??"",keys:sorted(role.permissionKeys)};
}
/** HO-specific editing surface; TDD owns navigation, DS owns cards and property rows. */
export function HoRoleEditor({ roleId, assignmentCount, authorized, activeTab }: {
  roleId:string; assignmentCount:number; authorized:boolean; activeTab:string;
}) {
  const [data,setData]=useState<Ready|null>(null);
  const [draft,setDraft]=useState<Draft|null>(null);
  const [loading,setLoading]=useState(true);
  const [busy,setBusy]=useState(false);
  const [confirming,setConfirming]=useState(false);
  const [error,setError]=useState("");
  const [notice,setNotice]=useState("");
  const [search,setSearch]=useState("");
  const [filter,setFilter]=useState<"all"|"selected"|"unselected">("all");
  const lock=useRef(false);
  useEffect(()=>{
    const controller=new AbortController();
    setLoading(true);setError("");setNotice("");setData(null);setDraft(null);
    void loadRole(roleId,controller.signal).then(value=>{
      if(controller.signal.aborted)return;
      setData(value);setDraft(fromRole(value.role));setLoading(false);
    }).catch(cause=>{
      if(controller.signal.aborted)return;
      setError(cause instanceof Error?cause.message:"Không thể tải Role.");setLoading(false);
    });
    return ()=>controller.abort();
  },[roleId]);
  const original=data?.role;
  const editable=Boolean(authorized && original?.roleType==="custom" &&
    original.status==="active" && original.roleKey!=="founder");
  const additions=draft&&original?draft.keys.filter(x=>!original.permissionKeys.includes(x)):[];
  const removals=draft&&original?original.permissionKeys.filter(x=>!draft.keys.includes(x)):[];
  const permissionDirty=Boolean(additions.length||removals.length);
  const dirty=Boolean(draft&&original&&(draft.displayName.trim()!==original.displayName ||
    (draft.description.trim()||null)!==(original.description?.trim()||null)||permissionDirty));
  const groups=useMemo(()=>{
    const q=search.trim().toLocaleLowerCase("vi");
    const map=new Map<string,BoAccessPermission[]>();
    for(const p of data?.permissions??[]){
      if(q && !(p.key+" "+p.displayLabel+" "+p.domain).toLocaleLowerCase("vi").includes(q))continue;
      const checked=draft?.keys.includes(p.key)??false;
      if((filter==="selected"&&!checked)||(filter==="unselected"&&checked))continue;
      const list=map.get(p.domain)??[];list.push(p);map.set(p.domain,list);
    }
    return [...map.entries()].sort((a,b)=>a[0].localeCompare(b[0],"vi"));
  },[data,draft?.keys,search,filter]);
  function toggle(key:string){
    if(!editable||busy||!draft||!data?.permissions.some(p=>p.key===key))return;
    setDraft(v=>v?{...v,keys:v.keys.includes(key)?v.keys.filter(k=>k!==key):sorted([...v.keys,key])}:v);
    setConfirming(false);setError("");setNotice("");
  }
  async function save(){
    if(lock.current||busy||!editable||!dirty||!draft||!original)return;
    const name=draft.displayName.trim();
    if(!name||name.length>120||draft.description.trim().length>500){setError("Tên Role phải có nội dung và mô tả không vượt 500 ký tự.");return;}
    if(permissionDirty&&!confirming){setConfirming(true);return;}
    lock.current=true;setBusy(true);setError("");setNotice("");
    try{
      const current=original;
      const wanted={displayName:name,description:draft.description.trim()||null,
        permissionKeys:sorted(draft.keys),expectedUpdatedAt:current.updatedAt};
      const response=await fetch("/api/ho/system/roles/"+encodeURIComponent(roleId)+"/update",{
        method:"POST",credentials:"same-origin",cache:"no-store",redirect:"error",
        headers:{"content-type":"application/json","idempotency-key":crypto.randomUUID()},
        body:JSON.stringify(wanted),
      });
      if(response.status===409)throw Error("Role đã được cập nhật bởi phiên khác. Tải lại Role trước khi tiếp tục.");
      if([401,403,404].includes(response.status))throw Error("Không đủ quyền sửa Role hoặc Role không còn khả dụng.");
      if(!response.ok)throw Error("Không lưu được Role. Vui lòng kiểm tra lại.");
      const controller=new AbortController();
      const next=await loadRole(roleId,controller.signal);
      if(next.role.displayName!==wanted.displayName ||
        (next.role.description?.trim()||null)!==wanted.description ||
        !same(next.role.permissionKeys,wanted.permissionKeys))
        throw Error("Core đã nhận yêu cầu nhưng chưa xác nhận được dữ liệu mới. Vui lòng tải lại Role.");
      setData(next);setDraft(fromRole(next.role));setConfirming(false);
      setNotice("Đã lưu và xác minh Role trên Core. Tải lại bảng để cập nhật số quyền.");
    }catch(cause){setError(cause instanceof Error?cause.message:"Không lưu được Role.");}
    finally{setBusy(false);lock.current=false;}
  }
  if(loading)return <p role="status">Đang tải chi tiết và danh mục quyền…</p>;
  if(!data||!draft)return <p role="alert">{error||"Không tải được Role."}</p>;
  const identityFields:PropertyField[]=[
    {key:"roleKey",label:"Role Key",type:"text",readOnly:true},
    {key:"roleId",label:"Role ID",type:"text",readOnly:true},
    {key:"roleType",label:"Loại",type:"text",readOnly:true},
    {key:"status",label:"Trạng thái",type:"text",readOnly:true},
    {key:"assignmentCount",label:"Số phân công",type:"number",readOnly:true},
  ];
  return <div data-testid="ho-role-editor" data-role-tab={activeTab}>
    <div hidden={activeTab!=="overview"}>
    <PropertySections recordKey={roleId} fields={identityFields} values={{
      roleKey:original!.roleKey,roleId:original!.id,roleType:original!.roleType,status:original!.status,
      assignmentCount:assignmentCount,
    }} sections={[{id:"role-identity",label:"Thông tin kỹ thuật",fields:identityFields.map(f=>f.key)}]}
      variant="detail" surface="ho" />
    <TosCard>
      <section aria-label="Chỉnh sửa thông tin Role">
        <h3>Thông tin Role</h3>
        <div className="property-row">
          <label className="property-label" htmlFor="role-display-name">Tên vai trò</label>
          <input id="role-display-name" value={draft.displayName} disabled={!editable||busy}
            maxLength={120} onChange={e=>{setDraft(v=>v?{...v,displayName:e.target.value}:v);setConfirming(false);setNotice("");}} />
        </div>
        <div className="property-row">
          <label className="property-label" htmlFor="role-description">Mô tả</label>
          <textarea id="role-description" value={draft.description} disabled={!editable||busy}
            maxLength={500} rows={3} onChange={e=>{setDraft(v=>v?{...v,description:e.target.value}:v);setConfirming(false);setNotice("");}} />
        </div>
        {!editable?<p role="status">Role hệ thống, đã lưu trữ hoặc tài khoản không có quyền chỉnh sửa: chỉ xem.</p>:null}
      </section>
    </TosCard>
    </div>
    <div hidden={activeTab!=="permissions"}>
    <TosCard>
      <section aria-label="Danh sách quyền của Role">
        <div className="ho-role-permission-summary">
          <div><h3>Quyền truy cập</h3><p>Nhóm theo domain · chọn từng quyền</p></div>
          <div aria-live="polite"><strong>{draft.keys.length} / {data.permissions.length} quyền</strong>
            <span>+{additions.length} thêm</span><span>−{removals.length} bỏ</span></div>
        </div>
        <label htmlFor="role-permission-search">Tìm kiếm quyền</label>
        <input id="role-permission-search" type="search" value={search} onChange={e=>setSearch(e.target.value)}
          placeholder="Tên quyền hoặc permission key" />
        <div className="ho-role-permission-filters" aria-label="Lọc quyền">
          {([["all","Tất cả"],["selected","Đã chọn"],["unselected","Chưa chọn"]] as const).map(([value,label])=>
            <button type="button" key={value} aria-pressed={filter===value}
              onClick={()=>setFilter(value)}>{label}</button>)}
        </div>
        {groups.length?groups.map(([domain,permissions])=><details key={domain} open={Boolean(search)||undefined}>
          <summary>{domain} · {permissions.filter(p=>draft.keys.includes(p.key)).length}/{permissions.length} quyền</summary>
          <fieldset disabled={!editable||busy}>
            <legend>{domain}</legend>
            {permissions.map(permission=><label className="property-row" key={permission.key}>
              <input type="checkbox" checked={draft.keys.includes(permission.key)}
                onChange={()=>toggle(permission.key)} />
              <span><strong>{permission.displayLabel}</strong>
                <small> {permission.key} · {permission.accessKind} · {permission.allowedScopes.join("/")}</small></span>
            </label>)}
          </fieldset>
        </details>):<p role="status">Không có quyền khớp tìm kiếm.</p>}
      </section>
    </TosCard>
    </div>
    {dirty&&permissionDirty&&!confirming?<p role="status">Thay đổi quyền chưa được lưu; sẽ ảnh hưởng tới {assignmentCount} phân công đang dùng Role này.</p>:null}
    {confirming&&permissionDirty?<TosCard><div role="alertdialog" aria-label="Xác nhận thay đổi quyền">
      <p>Thay đổi +{additions.length} / −{removals.length} quyền trên Role đang được gán cho {assignmentCount} phân công. Xác nhận lưu?</p>
      <TosButton variant="secondary" type="button" onClick={()=>setConfirming(false)}>Quay lại</TosButton>
      <TosButton variant="primary" type="button" disabled={busy} onClick={()=>void save()}>Xác nhận lưu</TosButton>
    </div></TosCard>:null}
    <div className="staff-actions">
      <TosButton type="button" variant="secondary" disabled={!dirty||busy}
        onClick={()=>{setDraft(fromRole(data.role));setConfirming(false);setError("");}}>Hủy thay đổi</TosButton>
      {!confirming?<TosButton type="button" variant="primary"
        disabled={!editable||!dirty||busy||!draft.displayName.trim()} onClick={()=>void save()}>
        {busy?"Đang lưu…":"Lưu Role"}
      </TosButton>:null}
    </div>
    {notice?<p role="status">{notice}</p>:null}
    {error?<p role="alert">{error}</p>:null}
  </div>;
}
