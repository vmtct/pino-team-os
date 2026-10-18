"use client";
import { useEffect, useRef, useState } from "react";
import { parseInstanceGridParams, writeInstanceGridParams, type InstanceGridUrlState } from "@/lib/pap736-instance-url-state";
import { BoDataGrid, type BoDataGridColumn } from "@/app/bo/components/data-grid";
import { PinoriaGrantDrawer } from "./PinoriaGrantDrawer";
import { PinoriaInstanceDetail } from "./PinoriaInstanceDetail";

type Status = "LIVE" | "INACTIVE" | "REVOKED";
type Row = {
  id: string; studentProfileId: string; studentDisplayName: string;
  worldId: string; worldName: string; worldKey: string; worldType: string;
  displayLabel: string; status: Status; grantedAt: string;
};
type Directory = { items: Row[]; total: number; limit: number; offset: number };
type Envelope<T> = { data?: T; error?: { message?: string } };
const columns: BoDataGridColumn<Row>[] = [
  { key: "studentName", header: "Student", render: r => <span>{r.studentDisplayName}<small style={{display:"block"}}>{r.studentProfileId}</small></span>, sortable:true },
  { key: "worldName", header: "World", render: r => <span>{r.worldName}<small style={{display:"block"}}>{r.worldKey} · {r.worldType}</small></span>, sortable:true },
  { key: "label", header: "Instance", render: r => <span>{r.displayLabel}<small style={{display:"block"}}>{r.id}</small></span>, sortable:true },
  { key: "status", header: "Status", render: r => r.status, sortable:true },
  { key: "grantedAt", header: "Granted", render: r => r.grantedAt.slice(0,10), sortable:true },
];
async function read<T>(path:string, signal?:AbortSignal):Promise<T> {
  const response=await fetch(`/api/bo/${path}`,{cache:"no-store",signal});
  const payload=(await response.json()) as Envelope<T>;
  if(!response.ok||!payload.data)throw new Error(payload.error?.message??"Canonical directory unavailable");
  return payload.data;
}
export function PinoriaInstanceDirectory() {
  const [query,setQuery]=useState(""),[status,setStatus]=useState<Status|"">(""),[worldId,setWorldId]=useState("");
  const [page,setPage]=useState(1),[size,setSize]=useState(25);
  const [sortKey,setSortKey]=useState("grantedAt"),[sortDirection,setSortDirection]=useState<"asc"|"desc">("desc");
  const [data,setData]=useState<Directory>({items:[],total:0,limit:25,offset:0});
  const [state,setState]=useState<"loading"|"ready"|"error"|"permission">("loading"),[error,setError]=useState("");
  const [selectedId,setSelectedId]=useState<string|null>(null);
  const [urlReady,setUrlReady]=useState(false),skipUrlWrite=useRef(true);
  const [epoch,setEpoch]=useState(0),[grantOpen,setGrantOpen]=useState(false);
  useEffect(()=>{
    const restore=()=>{
      const parsed=parseInstanceGridParams(new URLSearchParams(window.location.search));
      skipUrlWrite.current=true;
      setQuery(parsed.query);setStatus(parsed.status);setWorldId(parsed.worldId);setPage(parsed.page);setSize(parsed.size);
      setSortKey(parsed.sortKey);setSortDirection(parsed.sortDirection);setSelectedId(parsed.instanceId);
    };
    restore();setUrlReady(true);
    window.addEventListener("popstate",restore);
    return ()=>window.removeEventListener("popstate",restore);
  },[]);
  useEffect(()=>{
    if(!urlReady)return;
    if(skipUrlWrite.current){skipUrlWrite.current=false;return;}
    const next:InstanceGridUrlState={query,status,worldId,page,size:size as InstanceGridUrlState["size"],sortKey:sortKey as InstanceGridUrlState["sortKey"],sortDirection,instanceId:selectedId};
    const url=new URL(window.location.href);
    const nextQuery=writeInstanceGridParams(url.searchParams,next).toString();
    if(nextQuery!==url.searchParams.toString())window.history.pushState(window.history.state,"",url.pathname+(nextQuery?"?"+nextQuery:"")+url.hash);
  },[urlReady,query,status,worldId,page,size,sortKey,sortDirection,selectedId]);
  useEffect(()=>{
    const controller=new AbortController();
    const params=new URLSearchParams({limit:String(size),offset:String((page-1)*size),sortKey,sortDirection:sortDirection.toUpperCase()});
    if(query.trim())params.set("query",query.trim().slice(0,120));
    if(status)params.set("status",status);
    if(worldId)params.set("worldId",worldId);
    setState("loading");
    void read<Directory>(`pinoria/worlds/instances?${params}`,controller.signal).then(result=>{
      if(controller.signal.aborted)return;
      setData(result);setState("ready");setError("");
    }).catch(e=>{if(controller.signal.aborted)return;setData({items:[],total:0,limit:size,offset:0});setState(e instanceof Error&&/denied|forbidden|unauthoriz/i.test(e.message)?"permission":"error");setError(e instanceof Error?e.message:"Directory unavailable");});
    return ()=>controller.abort();
  },[query,status,worldId,page,size,sortKey,sortDirection,epoch]);
  return <section aria-label="Global WorldInstances directory" style={{minWidth:0,width:"100%"}}>
    <div style={{display:"flex",gap:12,marginBottom:12,flexWrap:"wrap"}}><button type="button" onClick={()=>setGrantOpen(true)}>+ Grant World</button>
      <label>Status <select value={status} onChange={e=>{setStatus(e.target.value as Status|"");setPage(1);}}><option value="">All statuses</option><option>LIVE</option><option>INACTIVE</option><option>REVOKED</option></select></label>
      <label>World ID <input value={worldId} onChange={e=>{setWorldId(e.target.value);setPage(1);}} placeholder="Filter by World ID"/></label>
    </div>
    <BoDataGrid rows={data.items} columns={columns} rowKey={r=>r.id} caption="Student WorldInstances"
      state={state} stateMessage={error} search={query} onSearchChange={value=>{setQuery(value);setPage(1);}}
      sortKey={sortKey} sortDirection={sortDirection} onSortChange={(key,direction)=>{setSortKey(key);setSortDirection(direction);setPage(1);}}
      pagination={{page,pageSize:size,total:data.total,pageSizeOptions:[10,25,50,100],onPageChange:setPage,onPageSizeChange:n=>{setSize(n);setPage(1);}}}
      resultLabel={`${data.total} canonical instances`} selectedRowKey={selectedId} onRowOpen={row=>setSelectedId(row.id)}
      onRefresh={()=>setEpoch(n=>n+1)} emptyTitle="No WorldInstances" emptyMessage="No matching canonical instances were returned."/>
    {grantOpen?<PinoriaGrantDrawer onClose={()=>setGrantOpen(false)} onGranted={id=>{setGrantOpen(false);setSelectedId(id);setQuery(id);setStatus("");setWorldId("");setPage(1);setEpoch(n=>n+1);}}/>:null}
    {selectedId?<PinoriaInstanceDetail key={selectedId} id={selectedId} onClose={()=>setSelectedId(null)} onChanged={()=>setEpoch(n=>n+1)}/>:null}
  </section>;
}
