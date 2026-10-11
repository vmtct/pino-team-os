"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  BoDataGrid,
  BoDataGridBadge,
  BoDataGridCanonicalId,
  BoDataGridSidePeek,
  BoDataGridStatus,
  type BoDataGridColumn,
} from "@/app/bo/components/data-grid";
import { useBoDataGridUrlState } from "@/app/bo/components/data-grid/useBoDataGridUrlState";
import {
  projectAiDataGrid,
  type AiDataChangeSetSummary,
  type AiDataInboxFilter,
  type AiDataInboxSort,
  type AiDataStatus,
} from "@/lib/bo-ai-data-grid";
import styles from "../../bo.module.css";
import local from "./ai-data-inbox.module.css";

const PAGE_SIZES = [10, 25, 50, 100] as const;
const SORT_KEYS: readonly AiDataInboxSort[] = ["purpose", "status", "operations", "submittedAt", "updatedAt"];
const FILTERS: readonly AiDataInboxFilter[] = ["", "PENDING_APPROVAL", "NEEDS_RECONCILE", "APPLIED", "REJECTED"];

type Operation={ref:string;resource:"operating_term"|"operating_term_week";op:"create";targetTable:"terms"|"term_weeks";recordId:string;data:Record<string,unknown>};
type Detail=AiDataChangeSetSummary&{idempotencyKey:string;plan:{schemaVersion:"v1";operations:Operation[]};validation:Record<string,unknown>;approvedByUserId:string|null;rejectedByUserId:string|null;rejectionReason:string|null;applyAttemptId:string|null;applyStartedAt:string|null;applyReceipt:Record<string,unknown>|null;reconcile:Record<string,unknown>|null};

export function AiDataInboxView(){
  const pathname=usePathname();
  const router=useRouter();
  const searchParams=useSearchParams();
  const grid=useBoDataGridUrlState({defaultPageSize:25,allowedPageSizes:PAGE_SIZES});
  const selectedId=searchParams.get("changeSet")??"";
  const [items,setItems]=useState<AiDataChangeSetSummary[]>([]);
  const [detail,setDetail]=useState<Detail|null>(null);
  const [loading,setLoading]=useState(true);
  const [detailLoading,setDetailLoading]=useState(false);
  const [busy,setBusy]=useState("");
  const [error,setError]=useState("");
  const [message,setMessage]=useState("");
  const setPageRef=useRef(grid.setPage);setPageRef.current=grid.setPage;

  const rawStatus=grid.state.filters.status??"";
  const status=FILTERS.includes(rawStatus as AiDataInboxFilter)?rawStatus as AiDataInboxFilter:"";
  const sort=SORT_KEYS.includes(grid.state.sortKey as AiDataInboxSort)?grid.state.sortKey as AiDataInboxSort:"updatedAt";
  const direction=grid.state.sortKey?grid.state.sortDirection:"desc";
  const projection=useMemo(()=>projectAiDataGrid(items,{page:grid.state.page,pageSize:grid.state.pageSize,search:grid.state.search,status,sort,direction}),[direction,grid.state.page,grid.state.pageSize,grid.state.search,items,sort,status]);

  const refresh=useCallback(async()=>{
    setError("");setLoading(true);
    try{setItems(await founderData<AiDataChangeSetSummary[]>("/api/founder/ai/change-sets"));}
    catch(cause){setError(errorMessage(cause));}
    finally{setLoading(false);}
  },[]);

  const loadDetail=useCallback(async(id:string)=>{
    if(!id){setDetail(null);return;}
    setError("");setDetailLoading(true);
    try{setDetail(await founderData<Detail>(`/api/founder/ai/change-sets/${id}`));}
    catch(cause){setDetail(null);setError(errorMessage(cause));}
    finally{setDetailLoading(false);}
  },[]);

  useEffect(()=>{void refresh();},[refresh]);
  useEffect(()=>{void loadDetail(selectedId);},[loadDetail,selectedId]);
  useEffect(()=>{if(projection.reconcilePage!==null)setPageRef.current(projection.reconcilePage);},[projection.reconcilePage]);

  function selectChangeSet(id:string,history:"push"|"replace"="push"){
    const params=new URLSearchParams(searchParams.toString());
    if(id)params.set("changeSet",id);else params.delete("changeSet");
    const query=params.toString();const href=query?`${pathname}?${query}`:pathname;
    if(history==="push")router.push(href,{scroll:false});else router.replace(href,{scroll:false});
  }

  async function mutate(action:"approve"|"reject"|"reconcile"){
    if(!detail)return;
    let body:Record<string,unknown>={};
    if(action==="approve"){
      if(!window.confirm(`Apply ${detail.preview.operationCount} proposed create operations to Production data?\n\nPlan hash: ${detail.planHash}`))return;
      body={expectedPlanHash:detail.planHash};
    }
    if(action==="reject"){
      const reason=window.prompt("Reason for rejecting this GPT proposal:");
      if(!reason?.trim())return;
      body={reason:reason.trim()};
    }
    setBusy(action);setError("");setMessage("");
    try{
      const next=await founderData<Detail>(`/api/founder/ai/change-sets/${detail.id}/${action}`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(body)});
      setDetail(next);
      setMessage(action==="approve"?"Applied with Founder authority.":action==="reject"?"Proposal rejected.":"Reconciliation completed without blind retry.");
      await refresh();
    }catch(cause){setError(errorMessage(cause));}
    finally{setBusy("");}
  }

  const pending=items.filter(item=>item.status==="PENDING_APPROVAL").length;
  const uncertain=items.filter(item=>item.status==="OUTCOME_UNKNOWN"||item.status==="APPLYING").length;
  const columns=useMemo<BoDataGridColumn<AiDataChangeSetSummary>[]>(()=>[
    {key:"purpose",header:"Change Set",sortable:true,sticky:true,minWidth:255,render:(item)=><div><strong>{item.purpose}</strong><BoDataGridCanonicalId value={item.id} label="Copy Change Set ID" /></div>},
    {key:"status",header:"Status",sortable:true,minWidth:175,render:(item)=><BoDataGridStatus value={formatStatus(item.status)} tone={statusTone(item.status)} />},
    {key:"operations",header:"Operations",sortable:true,minWidth:210,render:(item)=><div><strong>{item.preview.operationCount} create{item.preview.operationCount===1?"":"s"}</strong><br /><small>{item.preview.destinationTables.map(target=>`${target.table} ×${target.creates}`).join(", ")||"No destinations"}</small></div>},
    {key:"risk",header:"Destructive",minWidth:135,render:(item)=>item.preview.destructiveOperationCount===0?<BoDataGridBadge>CREATE ONLY</BoDataGridBadge>:<BoDataGridStatus value={`${item.preview.destructiveOperationCount} destructive`} tone="danger" />},
    {key:"submittedAt",header:"Submitted",sortable:true,minWidth:175,render:(item)=>new Date(item.submittedAt).toLocaleString("vi-VN")},
    {key:"updatedAt",header:"Updated",sortable:true,minWidth:175,render:(item)=>new Date(item.updatedAt).toLocaleString("vi-VN")},
    {key:"plan",header:"Plan hash",minWidth:170,render:(item)=><code>{item.planHash.slice(0,16)}…</code>},
  ],[]);
  const filtered=Boolean(grid.state.search||status);

  return <section className={styles.page}>
    <header className={styles.heading}>
      <span>PINO TEAM · SYSTEM</span>
      <h1>AI Data Inbox</h1>
      <p>GPT can prepare create-only Change Sets here, but cannot apply them. Production writes cross the Founder authority boundary only after review of the exact plan hash.</p>
    </header>

    <section className={styles.metrics}>
      <div className={styles.metric}><span>Pending approval</span><strong>{pending}</strong></div>
      <div className={styles.metric}><span>Needs reconcile</span><strong>{uncertain}</strong></div>
      <div className={styles.metric}><span>Total proposals</span><strong>{items.length}</strong></div>
      <div className={styles.metric}><span>Destructive ops</span><strong>{items.reduce((sum,item)=>sum+item.preview.destructiveOperationCount,0)}</strong></div>
    </section>

    {error?<p className={styles.ownerError}>{error}</p>:null}
    {message?<div className={styles.successCard}><span>AI Data</span><strong>{message}</strong></div>:null}

    <BoDataGrid
      rows={projection.items}
      columns={columns}
      rowKey={(item)=>item.id}
      caption="AI Data Change Set review inbox"
      state={loading?"loading":error?"error":"ready"}
      stateMessage={error||undefined}
      search={grid.state.search}
      onSearchChange={grid.setSearch}
      searchPlaceholder="Search purpose, Change Set ID, plan hash or destination…"
      sortKey={sort}
      sortDirection={direction}
      onSortChange={grid.setSort}
      filterChips={status?[{key:"status",label:"Review state",value:filterLabel(status),onClear:()=>grid.setFilter("status",null)}]:[]}
      toolbarActions={<label className={styles.gridToolbarFilter}>Review state<select aria-label="Filter AI Data Change Sets by review state" value={status} onChange={(event)=>grid.setFilter("status",event.target.value||null)}><option value="">All</option><option value="PENDING_APPROVAL">Pending approval</option><option value="NEEDS_RECONCILE">Needs reconcile</option><option value="APPLIED">Applied</option><option value="REJECTED">Rejected</option></select></label>}
      onRefresh={()=>void refresh()}
      resultLabel={`${projection.total} Change Sets`}
      pagination={{page:projection.page,pageSize:grid.state.pageSize,total:projection.total,pageSizeOptions:PAGE_SIZES,onPageChange:grid.setPage,onPageSizeChange:grid.setPageSize}}
      selectedRowKey={selectedId||null}
      onRowOpen={(item)=>selectChangeSet(item.id)}
      emptyTitle={filtered?"No matching Change Sets":"No AI data proposals yet"}
      emptyMessage={filtered?"Adjust search or review-state filter.":"GPT has not submitted a create-only Change Set for Founder review."}
    />

    {selectedId?<BoDataGridSidePeek title={detail?.purpose??"AI Data Change Set"} eyebrow="System · Founder review" onClose={()=>selectChangeSet("","replace")} footer={detail?<ReviewActions detail={detail} busy={busy} mutate={mutate} />:undefined}>
      {detailLoading?<p>Loading exact proposal…</p>:detail?<ChangeSetDetail detail={detail}/>:<p>Change Set detail is unavailable.</p>}
    </BoDataGridSidePeek>:null}
  </section>;
}

function ChangeSetDetail({detail}:{detail:Detail}){
  return <div>
    <section className={local.facts}>
      <div><span>Status</span><strong>{formatStatus(detail.status)}</strong></div>
      <div><span>Source / schema</span><strong>{detail.source} · {detail.schemaVersion}</strong></div>
      <div><span>Operations</span><strong>{detail.preview.operationCount}</strong></div>
      <div><span>Destructive</span><strong>{detail.preview.destructiveOperationCount}</strong></div>
    </section>
    <dl className={styles.auditDetailList}>
      <div><dt>Change Set ID</dt><dd><BoDataGridCanonicalId value={detail.id}/></dd></div>
      <div><dt>Submitted</dt><dd>{new Date(detail.submittedAt).toLocaleString("vi-VN")}</dd></div>
      <div><dt>Updated</dt><dd>{new Date(detail.updatedAt).toLocaleString("vi-VN")}</dd></div>
      <div><dt>Approved by</dt><dd>{detail.approvedByUserId??"Not approved"}</dd></div>
      <div><dt>Rejected by</dt><dd>{detail.rejectedByUserId??"Not rejected"}</dd></div>
      <div><dt>Rejection reason</dt><dd>{detail.rejectionReason??"n/a"}</dd></div>
    </dl>
    <div className={local.hashBox}><span>Plan hash — approval binds to this exact payload</span><code>{detail.planHash}</code></div>
    <div className={local.operationList}>
      {detail.plan.operations.map(operation=><article key={operation.ref} className={local.operation}>
        <div><strong>{operation.ref}</strong><span>{operation.op.toUpperCase()} · {operation.resource} → {operation.targetTable}</span></div>
        <code>{operation.recordId}</code>
        <pre>{JSON.stringify(operation.data,null,2)}</pre>
      </article>)}
    </div>
    {detail.reconcile?<details className={local.details}><summary>Reconciliation evidence</summary><pre>{JSON.stringify(detail.reconcile,null,2)}</pre></details>:null}
    {detail.applyReceipt?<details className={local.details}><summary>Apply receipt</summary><pre>{JSON.stringify(detail.applyReceipt,null,2)}</pre></details>:null}
  </div>;
}

function ReviewActions({detail,busy,mutate}:{detail:Detail;busy:string;mutate:(action:"approve"|"reject"|"reconcile")=>Promise<void>}){
  if(detail.status==="PENDING_APPROVAL")return <div className={local.actions}><button className={styles.primaryButton} disabled={Boolean(busy)} onClick={()=>void mutate("approve")}>{busy==="approve"?"Applying…":"Approve & Apply"}</button><button className={local.rejectButton} disabled={Boolean(busy)} onClick={()=>void mutate("reject")}>Reject</button></div>;
  if(detail.status==="APPLYING"||detail.status==="OUTCOME_UNKNOWN")return <div className={local.actions}><button className={styles.primaryButton} disabled={Boolean(busy)} onClick={()=>void mutate("reconcile")}>{busy==="reconcile"?"Reconciling…":"Reconcile outcome"}</button></div>;
  return <span>Review complete · no inline mutation available.</span>;
}

async function founderData<T>(path:string,init?:RequestInit):Promise<T>{
  const response=await fetch(path,{...init,cache:"no-store"});
  const payload=await response.json() as {data?:T;error?:{message?:string;code?:string}};
  if(!response.ok)throw new Error(payload.error?.message??payload.error?.code??`Request failed (${response.status})`);
  if(payload.data===undefined)throw new Error("Founder API returned no data");
  return payload.data;
}
function errorMessage(cause:unknown){return cause instanceof Error?cause.message:"AI Data request failed.";}
function formatStatus(status:AiDataStatus){return status.replaceAll("_"," ");}
function filterLabel(status:AiDataInboxFilter){return status==="NEEDS_RECONCILE"?"Needs reconcile":status.replaceAll("_"," ");}
function statusTone(status:AiDataStatus):"success"|"neutral"|"warning"|"danger"|"info"{if(status==="APPLIED")return"success";if(status==="REJECTED")return"danger";if(status==="PENDING_APPROVAL")return"warning";if(status==="APPLYING"||status==="OUTCOME_UNKNOWN")return"info";return"neutral";}
