"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { BoDataGrid, BoDataGridBadge, BoDataGridCanonicalId, BoDataGridSidePeek, BoDataGridStatus, type BoDataGridColumn } from "@/app/bo/components/data-grid";
import { useBoDataGridUrlState } from "@/app/bo/components/data-grid/useBoDataGridUrlState";
import { boApi, type BoPancakeChannel, type BoPancakeSettings } from "@/lib/bo-api";
import { projectPancakeChannels, type PancakeChannelFilter, type PancakeChannelSort } from "@/lib/bo-pancake-channel-grid";
import styles from "./pancake.module.css";

const PAGE_SIZES=[10,25,50,100] as const;
const SORT_KEYS:readonly PancakeChannelSort[]=["displayName","providerPageId","channel","status","discoveredBy","lastSeenAt","updatedAt"];
const FILTERS:readonly PancakeChannelFilter[]=["","ENABLED","DISABLED"];
type Load={state:"loading"}|{state:"error";message:string}|{state:"ready";settings:BoPancakeSettings;channels:BoPancakeChannel[]};

export function PancakeIntegrationView(){
  const pathname=usePathname();const router=useRouter();const searchParams=useSearchParams();
  const grid=useBoDataGridUrlState({defaultPageSize:25,allowedPageSizes:PAGE_SIZES});
  const selectedId=searchParams.get("pancakeChannel")??"";
  const [load,setLoad]=useState<Load>({state:"loading"});const [busy,setBusy]=useState(false);
  const setPageRef=useRef(grid.setPage);setPageRef.current=grid.setPage;
  const rawStatus=grid.state.filters.status??"";const status=FILTERS.includes(rawStatus as PancakeChannelFilter)?rawStatus as PancakeChannelFilter:"";
  const sort=SORT_KEYS.includes(grid.state.sortKey as PancakeChannelSort)?grid.state.sortKey as PancakeChannelSort:"updatedAt";
  const direction=grid.state.sortKey?grid.state.sortDirection:"desc";
  const channels=load.state==="ready"?load.channels:[];
  const projection=useMemo(()=>projectPancakeChannels(channels,{page:grid.state.page,pageSize:grid.state.pageSize,search:grid.state.search,status,sort,direction}),[channels,direction,grid.state.page,grid.state.pageSize,grid.state.search,sort,status]);
  const selected=channels.find(channel=>channel.id===selectedId)??null;

  const refresh=useCallback(async()=>{try{const [settings,nextChannels]=await Promise.all([boApi.pancakeSettings(),boApi.pancakeChannels()]);setLoad({state:"ready",settings,channels:nextChannels});}catch(error){setLoad({state:"error",message:message(error)});}},[]);
  useEffect(()=>{void refresh();},[refresh]);
  useEffect(()=>{if(load.state==="ready"&&projection.reconcilePage!==null)setPageRef.current(projection.reconcilePage);},[load.state,projection.reconcilePage]);

  function selectChannel(id:string,history:"push"|"replace"="push"){
    const params=new URLSearchParams(searchParams.toString());if(id)params.set("pancakeChannel",id);else params.delete("pancakeChannel");const query=params.toString();const href=query?`${pathname}?${query}`:pathname;if(history==="push")router.push(href,{scroll:false});else router.replace(href,{scroll:false});
  }
  async function toggleAutoDiscover(){if(load.state!=="ready"||busy)return;setBusy(true);try{await boApi.updatePancakeSettings({autoDiscoverChannels:!load.settings.autoDiscoverChannels,expectedVersion:load.settings.version});await refresh();}catch(error){setLoad({state:"error",message:message(error)});}finally{setBusy(false);}}

  const columns=useMemo<BoDataGridColumn<BoPancakeChannel>[]>(()=>[
    {key:"displayName",header:"Channel",sortable:true,sticky:true,minWidth:250,render:item=><div><strong>{item.displayName}</strong><BoDataGridCanonicalId value={item.providerPageId} label="Copy Pancake page_id" /></div>},
    {key:"status",header:"Status",sortable:true,minWidth:135,render:item=><BoDataGridStatus value={item.enabled?"ENABLED":"DISABLED"} tone={item.enabled?"success":"neutral"}/>},
    {key:"channel",header:"Provider",sortable:true,minWidth:130,render:item=><BoDataGridBadge>{item.channel}</BoDataGridBadge>},
    {key:"discoveredBy",header:"Discovery",sortable:true,minWidth:150,render:item=>item.discoveredBy==="PANCAKE_EVENT"?"Auto-discovered":"Manual"},
    {key:"lastSeenAt",header:"Last seen",sortable:true,minWidth:175,render:item=>new Date(item.lastSeenAt).toLocaleString("vi-VN")},
    {key:"updatedAt",header:"Updated",sortable:true,minWidth:175,render:item=>new Date(item.updatedAt).toLocaleString("vi-VN")},
  ],[]);

  return <main className={styles.page}>
    <header className={styles.heading}><div><span>Integration · PLT-LEAD</span><h1>Pancake</h1><p>Channel uses stable <code>page_id</code>. Chat routing continues to use the exact provider <code>conversation_link</code>; BO does not derive a locator.</p></div><div className={styles.permission}>acquisition.lead.manage</div></header>
    {load.state==="ready"?<section className={styles.setting}><div><strong>Auto-discover new channels</strong><p>Trusted events carrying a new <code>page_id</code> may materialize a Channel record. Disable to fail closed for unknown channels.</p></div><button type="button" className={load.settings.autoDiscoverChannels?styles.on:styles.off} disabled={busy} onClick={()=>void toggleAutoDiscover()}>{load.settings.autoDiscoverChannels?"Enabled":"Disabled"}</button></section>:null}
    <BoDataGrid rows={projection.items} columns={columns} rowKey={item=>item.id} caption="Pancake Channels inventory" state={load.state==="loading"?"loading":load.state==="error"?"error":"ready"} stateMessage={load.state==="error"?load.message:undefined} search={grid.state.search} onSearchChange={grid.setSearch} searchPlaceholder="Search page_id, display name or provider…" sortKey={sort} sortDirection={direction} onSortChange={grid.setSort} filterChips={status?[{key:"status",label:"Operational status",value:status,onClear:()=>grid.setFilter("status",null)}]:[]} toolbarActions={<label className={styles.gridFilter}>Status<select aria-label="Filter Pancake Channels by operational status" value={status} onChange={event=>grid.setFilter("status",event.target.value||null)}><option value="">All</option><option value="ENABLED">Enabled</option><option value="DISABLED">Disabled</option></select></label>} onRefresh={()=>void refresh()} resultLabel={`${projection.total} channels`} pagination={{page:projection.page,pageSize:grid.state.pageSize,total:projection.total,pageSizeOptions:PAGE_SIZES,onPageChange:grid.setPage,onPageSizeChange:grid.setPageSize}} selectedRowKey={selectedId||null} onRowOpen={busy?undefined:item=>selectChannel(item.id)} emptyTitle="No Pancake Channels" emptyMessage="No provider page_id has been materialized for this integration yet." />
    {selectedId?<BoDataGridSidePeek title={selected?.displayName??"Pancake Channel"} eyebrow="Integration · Channel detail" onClose={()=>selectChannel("","replace")}>{selected?<ChannelEditor key={`${selected.id}:${selected.version}`} channel={selected} onSaved={refresh}/>:<p>Selected Channel is no longer present in the canonical inventory.</p>}</BoDataGridSidePeek>:null}
  </main>;
}

function ChannelEditor({channel,onSaved}:{channel:BoPancakeChannel;onSaved:()=>Promise<void>}){
  const [displayName,setDisplayName]=useState(channel.displayName);const [enabled,setEnabled]=useState(channel.enabled);const [busy,setBusy]=useState(false);const [error,setError]=useState("");const changed=displayName.trim()!==channel.displayName||enabled!==channel.enabled;
  async function save(){if(!changed||!displayName.trim()||busy)return;setBusy(true);setError("");try{await boApi.configurePancakeChannel(channel.id,{displayName:displayName.trim(),enabled,expectedVersion:channel.version});await onSaved();}catch(cause){setError(message(cause));}finally{setBusy(false);}}
  return <div className={styles.detail}><dl><div><dt>Provider page_id</dt><dd><BoDataGridCanonicalId value={channel.providerPageId} label="Copy Pancake page_id"/></dd></div><div><dt>Channel record</dt><dd><BoDataGridCanonicalId value={channel.id}/></dd></div><div><dt>Provider</dt><dd>{channel.channel}</dd></div><div><dt>Discovery</dt><dd>{channel.discoveredBy==="PANCAKE_EVENT"?"Auto-discovered":"Manual"}</dd></div><div><dt>Created</dt><dd>{new Date(channel.createdAt).toLocaleString("vi-VN")}</dd></div><div><dt>Last seen</dt><dd>{new Date(channel.lastSeenAt).toLocaleString("vi-VN")}</dd></div></dl><label>Display name<input value={displayName} onChange={event=>setDisplayName(event.target.value)} maxLength={120}/></label><label className={styles.checkbox}><input type="checkbox" checked={enabled} onChange={event=>setEnabled(event.target.checked)}/> Enabled</label>{error?<p className={styles.detailError}>{error}</p>:null}<button type="button" disabled={!changed||!displayName.trim()||busy} onClick={()=>void save()}>{busy?"Saving…":"Save channel"}</button><p className={styles.detailNote}>Only display name and operational enabled state are editable. Provider identity remains the stable Pancake <code>page_id</code>.</p></div>;
}
function message(error:unknown){return error instanceof Error?error.message:"Unable to load Pancake configuration.";}
