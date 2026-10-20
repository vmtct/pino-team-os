"use client";
import {useCallback,useEffect,useMemo,useState} from 'react';
import {BoDataGrid,BoDataGridCanonicalId,BoDataGridSidePeek,BoDataGridStatus,type BoDataGridColumn} from '@/app/bo/components/data-grid';
import {BoApiError} from '@/lib/bo-api';
import {boMissions,type BoMission,type BoMissionDraft,type MissionStatus,type MissionPaperSize} from '@/lib/bo-missions';
import styles from '../student-visits/student-visits.module.css';
const PAGE_SIZE=25;
const blank:BoMissionDraft={code:'',name:'',level:1,status:'ACTIVE',description:null,guideline:null,plsValue:0,paperSize:null,pathProgramId:null,pathKeySnapshot:null,prerequisiteMissionId:null,prerequisiteCodeSnapshot:null};
function draftFrom(row:BoMission):BoMissionDraft{return{code:row.code,name:row.name,level:row.level,status:row.status,description:row.description,guideline:row.guideline,plsValue:row.plsValue,paperSize:row.paperSize,pathProgramId:row.pathProgramId,pathKeySnapshot:row.pathKeySnapshot,prerequisiteMissionId:row.prerequisiteMissionId,prerequisiteCodeSnapshot:row.prerequisiteCodeSnapshot};}
function message(error:unknown){return error instanceof Error?error.message:'Mission Catalog request failed';}
export function MissionCatalogView(){
 const [search,setSearch]=useState(''),[status,setStatus]=useState<MissionStatus|'ALL'>('ALL'),[level,setLevel]=useState(0),[page,setPage]=useState(1);
 const [rows,setRows]=useState<BoMission[]>([]),[hasMore,setHasMore]=useState(false),[loading,setLoading]=useState(true),[error,setError]=useState(''),[refresh,setRefresh]=useState(0);
 const [selected,setSelected]=useState<BoMission|null>(null),[drawer,setDrawer]=useState<'create'|'edit'|null>(null),[form,setForm]=useState<BoMissionDraft>(blank);
 const [saveBusy,setSaveBusy]=useState(false),[drawerError,setDrawerError]=useState(''),[notice,setNotice]=useState('');
 const dirty=drawer!==null&&JSON.stringify(form)!==JSON.stringify(drawer==='edit'&&selected?draftFrom(selected):blank);
 const close=useCallback(()=>{if(dirty&&!window.confirm('Discard unsaved Mission changes?'))return;setDrawer(null);setSelected(null);setDrawerError('');},[dirty]);
 useEffect(()=>{let live=true;setLoading(true);setError('');
  void boMissions.list({search:search.trim()||undefined,status:status==='ALL'?undefined:status,level:level||undefined,limit:PAGE_SIZE+1,offset:(page-1)*PAGE_SIZE})
   .then(list=>{if(live){setRows(list.slice(0,PAGE_SIZE));setHasMore(list.length>PAGE_SIZE);}})
   .catch(e=>{if(live){setRows([]);setError(message(e));}}).finally(()=>{if(live)setLoading(false)});
  return()=>{live=false};
 },[search,status,level,page,refresh]);
 const columns=useMemo<BoDataGridColumn<BoMission>[]>(()=>[
  {key:'code',header:'Code',sticky:true,minWidth:160,render:r=><div><strong>{r.code}</strong><br/><BoDataGridCanonicalId value={r.id} label="Copy Mission ID"/></div>},
  {key:'name',header:'Mission',minWidth:200,render:r=>r.name},
  {key:'level',header:'Level',minWidth:80,render:r=>'LV '+r.level},
  {key:'status',header:'State',minWidth:110,render:r=><BoDataGridStatus value={r.status} tone={r.status==='ACTIVE'?'success':'neutral'}/>},
  {key:'pls',header:'PLS',minWidth:75,render:r=>r.plsValue},
  {key:'paper',header:'Paper',minWidth:90,render:r=>r.paperSize??'—'},
  {key:'reconcile',header:'Reconciliation',minWidth:130,render:r=><BoDataGridStatus value={r.reconciliation} tone={r.reconciliation==='READY'?'success':'warning'}/>}
 ],[]);
 function openCreate(){if(dirty&&!window.confirm('Discard unsaved Mission changes?'))return;setSelected(null);setForm({...blank});setDrawer('create');setDrawerError('');}
 async function openEdit(row:BoMission){if(dirty&&!window.confirm('Discard unsaved Mission changes?'))return;setDrawer('edit');setSelected(row);setForm(draftFrom(row));setDrawerError('');
  try{const current=await boMissions.get(row.id);setSelected(current);setForm(draftFrom(current));}catch(e){setDrawerError(message(e));}
 }
 async function save(){if(!drawer||saveBusy)return;setSaveBusy(true);setDrawerError('');setNotice('');
  try{const normalized={...form,code:form.code.trim().toUpperCase(),name:form.name.trim()};
   const current=drawer==='edit'?selected:null;
   const saved=current?await boMissions.update(current.id,{...normalized,expectedVersion:current.version},crypto.randomUUID()):await boMissions.create(normalized,crypto.randomUUID());
   setNotice('Mission saved in Core · '+saved.code+' · v'+saved.version);setSelected(saved);setForm(draftFrom(saved));setDrawer(null);setRefresh(n=>n+1);
  }catch(e){const conflict=e instanceof BoApiError&&e.status===409;setDrawerError((conflict?'Concurrent change or duplicate code. Reload the row before retrying. ':'')+message(e));}
  finally{setSaveBusy(false);}
 }
 function edit<K extends keyof BoMissionDraft>(key:K,value:BoMissionDraft[K]){setForm(old=>({...old,[key]:value}));}
 const totalLowerBound=(page-1)*PAGE_SIZE+rows.length+(hasMore?1:0);
 return <main className={styles.page}>
  <header><span className={styles.eyebrow}>Back Office · Learning</span><h1>Mission Catalog</h1><p>Canonical Mission definitions. Registration and completion evidence are recorded separately in TOS Classroom Diary; editing this catalog never grants PLS.</p></header>
  {notice?<p role="status" className={styles.notice}>{notice}</p>:null}
  <BoDataGrid rows={rows} rowKey={r=>r.id} columns={columns} caption="Learning · Mission definitions"
   state={loading?'loading':error?'error':'ready'} stateMessage={error||undefined}
   search={search} onSearchChange={v=>{setSearch(v);setPage(1)}} searchPlaceholder="Search code or Mission name"
   resultLabel={hasMore?`At least ${totalLowerBound} Missions`:`${totalLowerBound} Missions`}
   onRefresh={()=>setRefresh(n=>n+1)}
   toolbarActions={<div className={styles.actions}>
    <label>Status<select aria-label="Mission status filter" value={status} onChange={e=>{setStatus(e.target.value as MissionStatus|'ALL');setPage(1)}}><option value="ALL">All states</option><option value="ACTIVE">Active</option><option value="INACTIVE">Inactive</option></select></label>
    <label>Level<select aria-label="Mission level filter" value={level} onChange={e=>{setLevel(Number(e.target.value));setPage(1)}}><option value={0}>All levels</option>{[1,2,3,4,5].map(n=><option key={n} value={n}>LV {n}</option>)}</select></label>
    <button type="button" onClick={openCreate}>+ New Mission</button>
   </div>}
   pagination={{page,pageSize:PAGE_SIZE,total:totalLowerBound,pageSizeOptions:[PAGE_SIZE],onPageChange:setPage}}
   onRowOpen={row=>void openEdit(row)} selectedRowKey={selected?.id??null}
   emptyTitle="No Missions" emptyMessage="No canonical Mission definitions match this filter."/>
  {drawer?<BoDataGridSidePeek title={drawer==='create'?'Create Mission':selected?.name??'Edit Mission'} eyebrow="Learning · Mission Catalog" onClose={close}>
   <div className={styles.detail}>
    {drawerError?<p role="alert">{drawerError}</p>:null}
    {selected?<p><BoDataGridCanonicalId value={selected.id} label="Copy Mission ID"/> · v{selected.version}</p>:null}
    <div className={styles.form}>
     <label>Mission Code<input autoFocus value={form.code} maxLength={64} onChange={e=>edit('code',e.target.value)} placeholder="M-001" required/></label>
     <label>Mission Name<input value={form.name} maxLength={160} onChange={e=>edit('name',e.target.value)} required/></label>
     <label>Level<select value={form.level} onChange={e=>edit('level',Number(e.target.value))}>{[1,2,3,4,5].map(v=><option key={v} value={v}>LV {v}</option>)}</select></label>
     <label>Status<select value={form.status} onChange={e=>edit('status',e.target.value as MissionStatus)}><option value="ACTIVE">ACTIVE</option><option value="INACTIVE">INACTIVE</option></select></label>
     <label>Description<textarea rows={3} maxLength={4000} value={form.description??''} onChange={e=>edit('description',e.target.value||null)}/></label>
     <label>Teacher Guideline<textarea rows={5} maxLength={8000} value={form.guideline??''} onChange={e=>edit('guideline',e.target.value||null)}/></label>
     <label>PLS value (catalog only)<input type="number" min="0" step="1" value={form.plsValue} onChange={e=>edit('plsValue',Number(e.target.value))}/></label>
     <label>Paper Size<select value={form.paperSize??''} onChange={e=>edit('paperSize',(e.target.value||null) as MissionPaperSize|null)}><option value="">Unspecified</option><option value="B5">B5</option><option value="A4">A4</option><option value="A3">A3</option></select></label>
     <label>Path ID (soft reference)<input value={form.pathProgramId??''} onChange={e=>edit('pathProgramId',e.target.value||null)}/></label>
     <label>Path snapshot<input value={form.pathKeySnapshot??''} onChange={e=>edit('pathKeySnapshot',e.target.value||null)}/></label>
     <label>Prerequisite Mission ID (soft reference)<input value={form.prerequisiteMissionId??''} onChange={e=>edit('prerequisiteMissionId',e.target.value||null)}/></label>
     <label>Prerequisite Code snapshot<input value={form.prerequisiteCodeSnapshot??''} onChange={e=>edit('prerequisiteCodeSnapshot',e.target.value||null)}/></label>
    </div>
    {selected?.diagnostics.length?<p role="status">Reconciliation pending: {selected.diagnostics.join(', ')}. Saving remains allowed.</p>:null}
    <div className={styles.actionRow}>
     <button type="button" disabled={saveBusy||!form.code.trim()||!form.name.trim()||!Number.isSafeInteger(form.plsValue)||form.plsValue<0} onClick={()=>void save()}>{saveBusy?'Saving…':drawer==='create'?'Create Mission':'Save changes'}</button>
     <button type="button" onClick={close} disabled={saveBusy}>Cancel</button>
     {drawer==='edit'&&selected?<button type="button" disabled={saveBusy} onClick={()=>void openEdit(selected)}>Reload latest</button>:null}
    </div>
   </div>
  </BoDataGridSidePeek>:null}
 </main>;
}
