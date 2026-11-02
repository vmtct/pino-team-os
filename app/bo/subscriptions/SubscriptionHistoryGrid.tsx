"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { boApi, BoApiError } from "@/lib/bo-api";
import type { BoSubscriptionDirectoryItem, BoSubscriptionDirectoryPage, BoPathProgram } from "@/lib/bo-model";
import type { BoRecord } from "@/lib/bo-registration";
import type { BoFilterSettings, BoFilterField } from "@/lib/bo-filter-settings-state";
import { BoDataGrid, BoDataGridCanonicalId, BoDataGridStatus, type BoDataGridColumn } from "@/app/bo/components/data-grid";
import { useBoDataGridUrlState } from "@/app/bo/components/data-grid/useBoDataGridUrlState";
import { useAuthorizedBoPublicView } from "@/app/bo/components/data-grid/useAuthorizedBoPublicView";
import { useBoPilotSharedGridView } from "@/app/bo/components/data-grid/useBoPilotSharedGridView";
import { BoQuickView } from "@/app/bo/components/registration/BoQuickView";
import { subscriptionModule } from "@/app/bo/components/registration/BoStudentSubscriptionRelation";
import styles from "./subscription-read-surface.module.css";

type Cursor = { createdAt: string; id: string } | null;
type PageData = { state: "loading" } | { state: "error" | "permission"; message: string } | { state: "ready"; value: BoSubscriptionDirectoryPage };
const FIELDS: readonly BoFilterField[] = [
  { key: "pathProgramId", type: "text", filterable: true },
  { key: "lifecycle", type: "text", filterable: true },
  { key: "pathDisplayName", type: "text", filterable: false },
  { key: "id", type: "text", filterable: false },
  { key: "studentDisplayName", type: "text", filterable: false },
  { key: "weeklyCommitment", type: "number", filterable: false },
  { key: "serviceStartsOn", type: "date", filterable: false },
  { key: "contractualEndsOn", type: "date", filterable: false },
  { key: "effectiveAvailableUnits", type: "number", filterable: false },
  { key: "finalAmountMinor", type: "number", filterable: false },
];
const KEYS=FIELDS.map(f=>f.key);
const INITIAL: BoFilterSettings={group:{combinator:"and",filters:[]},visibleKeys:[...KEYS]};
const COLUMNS: readonly BoDataGridColumn<BoSubscriptionDirectoryItem>[]=[
  {key:"pathDisplayName",header:"Path",sticky:true,width:180,render:r=><strong>{r.pathDisplayName}</strong>},
  {key:"id",header:"ID",width:160,render:r=><BoDataGridCanonicalId value={r.id} />},
  {key:"studentDisplayName",header:"Học viên",width:172,render:r=>r.studentDisplayName},
  {key:"lifecycle",header:"Trạng thái",width:145,render:r=><BoDataGridStatus value={r.lifecycle} tone={r.lifecycle==="ACTIVE"?"success":r.lifecycle==="DRAFT"?"warning":r.lifecycle==="CANCELLED"?"danger":"neutral"}/>},
  {key:"weeklyCommitment",header:"Buổi/tuần",width:100,render:r=>r.weeklyCommitment},
  {key:"serviceStartsOn",header:"Ngày bắt đầu",width:148,render:r=>r.serviceStartsOn||"—"},
  {key:"contractualEndsOn",header:"Ngày kết thúc",width:148,render:r=>r.contractualEndsOn||"—"},
  {key:"effectiveAvailableUnits",header:"Buổi còn",width:95,render:r=>r.effectiveAvailableUnits},
  {key:"finalAmountMinor",header:"Thành tiền",width:142,render:r=>r.finalAmountMinor==null?"—":r.finalAmountMinor.toLocaleString("vi-VN")+" ₫"}
];
function asDetailRecord(r:BoSubscriptionDirectoryItem): BoRecord {
  return {
    id:r.id,name:r.studentDisplayName,path:r.pathDisplayName,status:r.lifecycle,
    weekly:r.weeklyCommitment,remaining:r.effectiveAvailableUnits,start:r.serviceStartsOn,
    end:r.contractualEndsOn,reference:r.commercialReference
  };
}
/** Core supports search, Path and lifecycle, plus createdAt/ID cursor. It does NOT expose arbitrary server sort. */
function serverFilters(settings:BoFilterSettings):{lifecycle:string;pathProgramId:string;error:string|null}{
  if(settings.group.combinator!=="and")return {lifecycle:"",pathProgramId:"",error:"Bộ lọc OR chưa được Core Subscription hỗ trợ."};
  const out={lifecycle:"",pathProgramId:"",error:null as string|null};
  for(const rule of settings.group.filters){
    if((rule.field!=="lifecycle"&&rule.field!=="pathProgramId")||rule.operator!=="equals"||!rule.value){
      out.error="Subscription Core hiện chỉ hỗ trợ bộ lọc BẰNG cho Path và trạng thái.";break;
    }
    if(out[rule.field]&&out[rule.field]!==rule.value){out.error="Các điều kiện trùng thuộc tính mâu thuẫn.";break;}
    out[rule.field]=rule.value;
  }
  return out;
}
export function SubscriptionHistoryGrid({paths,refreshVersion,onFullDetail}:{
  paths:BoPathProgram[];refreshVersion:number;onFullDetail?:(record:BoRecord)=>void;
}){
  const grid=useBoDataGridUrlState({defaultPageSize:25,allowedPageSizes:[25]});
  const [typed,setTyped]=useState<BoFilterSettings>(INITIAL);
  const runtime=useAuthorizedBoPublicView("subscriptions","membership.subscription.view",KEYS);
  const view=useBoPilotSharedGridView({runtime,fields:FIELDS,sortableKeys:[],typed,setTyped,grid});
  const [pageData,setPageData]=useState<PageData>({state:"loading"});
  const [drawer,setDrawer]=useState<BoSubscriptionDirectoryItem|null>(null);
  const [reload,setReload]=useState(0);
  const nextCursors=useRef(new Map<number,Cursor>([[1,null]]));
  const previousKey=useRef("");
  const epoch=useRef(0);
  const parsed=serverFilters(typed);
  const filterKey=JSON.stringify([grid.state.search,parsed.lifecycle,parsed.pathProgramId,grid.state.pageSize,parsed.error]);
  useEffect(()=>{
    if(previousKey.current===filterKey)return;
    previousKey.current=filterKey;
    nextCursors.current=new Map([[1,null]]);
    if(grid.state.page!==1)grid.setPage(1);
  },[filterKey,grid]);
  const refresh=()=>setReload(n=>n+1);
  useEffect(()=>{
    const serial=++epoch.current;
    if(parsed.error){setPageData({state:"error",message:parsed.error});return;}
    const page=grid.state.page;
    if(!nextCursors.current.has(page)){
      grid.setPage(1);
      return;
    }
    const cursor=nextCursors.current.get(page)??null;
    setPageData({state:"loading"});
    void boApi.subscriptionDirectory({
      query:grid.state.search.trim(),lifecycle:parsed.lifecycle,pathProgramId:parsed.pathProgramId,
      limit:grid.state.pageSize,
      ...(cursor?{beforeCreatedAt:cursor.createdAt,beforeSubscriptionId:cursor.id}:{})
    }).then(value=>{
      if(serial!==epoch.current)return;
      if(value.nextCursor)nextCursors.current.set(page+1,value.nextCursor);
      setPageData({state:"ready",value});
    }).catch(error=>{
      if(serial!==epoch.current)return;
      setPageData({
        state:error instanceof BoApiError&&(error.status===401||error.status===403)?"permission":"error",
        message:error instanceof Error?error.message:"Không thể tải Subscriptions."
      });
    });
    return ()=>{epoch.current++;};
    // Hooks expose stable primitives for search/page; serialized filter is the query authority.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[filterKey,grid.state.page,grid.state.pageSize,refreshVersion,reload]);
  const result=pageData.state==="ready"?pageData.value:null;
  const availableColumns=useMemo(()=>COLUMNS,[]);
  const filterChips=typed.group.filters.map((rule,i)=>({
    key:String(i),label:rule.field==="pathProgramId"?"Path":"Trạng thái",value:rule.value,
    onClear:()=>view.onTypedFilterSettingsChange({...typed,group:{...typed.group,filters:typed.group.filters.filter((_,n)=>n!==i)}})
  }));
  const total=result?.total??0;
  const currentPage=grid.state.page;
  return <section aria-label="Subscriptions" className={styles.root}>
    {view.viewError?<p role="alert" className={styles.error}>{view.viewError}</p>:null}
    <BoDataGrid
      caption="Danh sách Subscription" rows={result?.items??[]}
      rowKey={row=>row.id} columns={availableColumns}
      state={pageData.state==="ready"?"ready":pageData.state}
      stateMessage={pageData.state==="error"||pageData.state==="permission"?pageData.message:undefined}
      search={grid.state.search} onSearchChange={view.onSearchChange} searchPlaceholder="Tìm Subscription, học viên, mã..."
      publicViewRuntime={runtime??undefined}
      typedFilterFields={FIELDS} typedFilterSettings={typed}
      onTypedFilterSettingsChange={next=>{view.onTypedFilterSettingsChange(next);grid.setPage(1);}}
      columnOrder={view.columnOrder} rowsAlreadyFiltered
      filterChips={filterChips}
      resultLabel={result?total+" bản ghi":undefined} onRefresh={refresh}
      quickViewOpener onRowOpen={setDrawer} selectedRowKey={drawer?.id}
      pagination={{page:currentPage,pageSize:grid.state.pageSize,total,
        onPageChange:next=>{if(next<=1||nextCursors.current.has(next))grid.setPage(next);}}}
      emptyTitle="Không có Subscription phù hợp"
      emptyMessage="Kiểm tra bộ lọc hoặc tìm theo mã học viên."
    />
    <div className={styles.serverHint}>Danh sách được phân trang theo Core cursor; không tự sắp xếp trên dữ liệu một trang.</div>
    {drawer?<BoQuickView module={subscriptionModule} record={asDetailRecord(drawer)}
      onClose={()=>setDrawer(null)}
      onDetail={()=>{onFullDetail?.(asDetailRecord(drawer));setDrawer(null);}} />:null}
    <span className={styles.pathCount} aria-hidden="true">{paths.length} Paths</span>
  </section>;
}
