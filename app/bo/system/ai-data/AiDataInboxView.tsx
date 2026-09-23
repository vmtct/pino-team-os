"use client";

import { useCallback, useEffect, useState } from "react";
import styles from "../../bo.module.css";
import local from "./ai-data-inbox.module.css";

type Status="PENDING_APPROVAL"|"APPLYING"|"APPLIED"|"REJECTED"|"OUTCOME_UNKNOWN";
type Preview={operationCount:number;destructiveOperationCount:0;destinationTables:Array<{table:string;creates:number}>};
type Summary={id:string;status:Status;source:"GPT";purpose:string;schemaVersion:"v1";planHash:string;preview:Preview;submittedAt:string;updatedAt:string;approvedAt:string|null;rejectedAt:string|null;appliedAt:string|null;version:number};
type Operation={ref:string;resource:"operating_term"|"operating_term_week";op:"create";targetTable:"terms"|"term_weeks";recordId:string;data:Record<string,unknown>};
type Detail=Summary&{idempotencyKey:string;plan:{schemaVersion:"v1";operations:Operation[]};validation:Record<string,unknown>;approvedByUserId:string|null;rejectedByUserId:string|null;rejectionReason:string|null;applyAttemptId:string|null;applyStartedAt:string|null;applyReceipt:Record<string,unknown>|null;reconcile:Record<string,unknown>|null};

export function AiDataInboxView(){
  const [items,setItems]=useState<Summary[]>([]);
  const [detail,setDetail]=useState<Detail|null>(null);
  const [selectedId,setSelectedId]=useState("");
  const [busy,setBusy]=useState("");
  const [error,setError]=useState("");
  const [message,setMessage]=useState("");

  const loadDetail=useCallback(async(id:string)=>{
    setSelectedId(id);setError("");
    try{setDetail(await founderData<Detail>(`/api/founder/ai/change-sets/${id}`));}
    catch(cause){setError(errorMessage(cause));}
  },[]);

  const refresh=useCallback(async()=>{
    setError("");
    try{
      const next=await founderData<Summary[]>("/api/founder/ai/change-sets");
      setItems(next);
      if(selectedId){
        const still=next.find(item=>item.id===selectedId);
        if(still)await loadDetail(selectedId); else {setSelectedId("");setDetail(null);}
      }
    }catch(cause){setError(errorMessage(cause));}
  },[loadDetail,selectedId]);

  useEffect(()=>{void refresh();},[refresh]);

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
      const list=await founderData<Summary[]>("/api/founder/ai/change-sets");setItems(list);
    }catch(cause){setError(errorMessage(cause));}
    finally{setBusy("");}
  }

  const pending=items.filter(item=>item.status==="PENDING_APPROVAL").length;
  const uncertain=items.filter(item=>item.status==="OUTCOME_UNKNOWN"||item.status==="APPLYING").length;

  return <section className={styles.page}>
    <header className={styles.heading}>
      <span>PINO TEAM · SYSTEM</span>
      <h1>AI Data Inbox</h1>
      <p>GPT can prepare create-only Change Sets here, but cannot apply them. Production writes cross the Founder authority boundary only after review of the exact plan hash.</p>
    </header>

    <section className={styles.metrics}>
      <div className={styles.metric}><span>Pending approval</span><strong>{pending}</strong></div>
      <div className={styles.metric}><span>Needs reconcile</span><strong>{uncertain}</strong></div>
      <div className={styles.metric}><span>Total shown</span><strong>{items.length}</strong></div>
      <div className={styles.metric}><span>Destructive ops</span><strong>0</strong></div>
    </section>

    {error?<p className={styles.ownerError}>{error}</p>:null}
    {message?<div className={styles.successCard}><span>AI Data</span><strong>{message}</strong></div>:null}

    <section className={styles.panel}>
      <div className={styles.panelHeading}>
        <div><h2>Change Sets</h2><p>v1 allows registered create operations only: Terms and TermWeeks. No raw SQL, update, or delete.</p></div>
        <button className={styles.secondaryButton} onClick={()=>void refresh()} disabled={Boolean(busy)}>Refresh</button>
      </div>
      <div className={styles.ownerQueue}>
        {items.length===0?<div className={styles.empty}>No AI data proposals yet.</div>:items.map(item=>
          <button key={item.id} type="button" className={`${local.changeSetRow} ${item.id===selectedId?local.selected:""}`} onClick={()=>void loadDetail(item.id)}>
            <div>
              <strong>{item.purpose}</strong>
              <span>{formatStatus(item.status)} · {new Date(item.submittedAt).toLocaleString("vi-VN")}</span>
              <small>{item.preview.operationCount} creates → {item.preview.destinationTables.map(target=>`${target.table} ×${target.creates}`).join(", ")}</small>
            </div>
            <code>{item.planHash.slice(0,12)}…</code>
          </button>)}
      </div>
    </section>

    {detail?<section className={styles.panel}>
      <div className={styles.panelHeading}>
        <div><h2>Review exact proposal</h2><p>{detail.id}</p></div>
        <span className={styles.statusPill}>{formatStatus(detail.status)}</span>
      </div>
      <div className={local.facts}>
        <div><span>Source</span><strong>{detail.source}</strong></div>
        <div><span>Schema</span><strong>{detail.schemaVersion}</strong></div>
        <div><span>Operations</span><strong>{detail.preview.operationCount}</strong></div>
        <div><span>Destructive</span><strong>{detail.preview.destructiveOperationCount}</strong></div>
      </div>
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

      <div className={local.actions}>
        {detail.status==="PENDING_APPROVAL"?<>
          <button className={styles.primaryButton} disabled={Boolean(busy)} onClick={()=>void mutate("approve")}>{busy==="approve"?"Applying…":"Approve & Apply"}</button>
          <button className={local.rejectButton} disabled={Boolean(busy)} onClick={()=>void mutate("reject")}>Reject</button>
        </>:null}
        {(detail.status==="APPLYING"||detail.status==="OUTCOME_UNKNOWN")?
          <button className={styles.primaryButton} disabled={Boolean(busy)} onClick={()=>void mutate("reconcile")}>{busy==="reconcile"?"Reconciling…":"Reconcile outcome"}</button>:null}
      </div>
    </section>:null}
  </section>;
}

async function founderData<T>(path:string,init?:RequestInit):Promise<T>{
  const response=await fetch(path,{...init,cache:"no-store"});
  const payload=await response.json() as {data?:T;error?:{message?:string;code?:string}};
  if(!response.ok)throw new Error(payload.error?.message??payload.error?.code??`Request failed (${response.status})`);
  if(payload.data===undefined)throw new Error("Founder API returned no data");
  return payload.data;
}
function errorMessage(cause:unknown){return cause instanceof Error?cause.message:"AI Data request failed.";}
function formatStatus(status:Status){return status.replaceAll("_"," ");}
