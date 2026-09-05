"use client";

import { useEffect, useMemo, useState } from "react";
import { boApi, BoApiError } from "@/lib/bo-api";
import type { BoLearningSyllabusDetail, BoLearningSyllabusDraftInput, BoLearningSyllabusOwner, BoLearningSyllabusOwnerCatalog, BoLearningSyllabusOwnerType, BoLearningSyllabusSummary } from "@/lib/bo-model";
import styles from "../bo.module.css";
import { SyllabusProfileEditor } from "./SyllabusProfileEditor";

type DraftForm = { title:string; shortDescription:string; publicDescription:string; tags:string; sourceType:string; sourceRef:string };
type LoadState = {status:"loading"}|{status:"error";message:string;requestId:string|null}|{status:"ready"};
const blankDraft:DraftForm={title:"",shortDescription:"",publicDescription:"",tags:"",sourceType:"FOUNDER_AUTHORED",sourceRef:""};

export function LearningSyllabusDesk(){
  const [load,setLoad]=useState<LoadState>({status:"loading"});
  const [owners,setOwners]=useState<BoLearningSyllabusOwnerCatalog>({housePaths:[],houseCurricula:[],toppiPrograms:[]});
  const [rows,setRows]=useState<BoLearningSyllabusSummary[]>([]);
  const [selectedId,setSelectedId]=useState("");
  const [detail,setDetail]=useState<BoLearningSyllabusDetail|null>(null);
  const [ownerType,setOwnerType]=useState<"ALL"|BoLearningSyllabusOwnerType>("ALL");
  const [ownerId,setOwnerId]=useState("");
  const [createOpen,setCreateOpen]=useState(false);
  const [createOwnerType,setCreateOwnerType]=useState<BoLearningSyllabusOwnerType>("HOUSE_PATH");
  const [createOwnerId,setCreateOwnerId]=useState("");
  const [code,setCode]=useState("");
  const [form,setForm]=useState<DraftForm>(blankDraft);
  const [busy,setBusy]=useState("");
  const [error,setError]=useState<{message:string;requestId:string|null}|null>(null);

  const ownerOptions=useMemo(()=>ownerOptionsFor(owners,createOwnerType),[createOwnerType,owners]);
  const filterOptions=useMemo(()=>ownerType==="ALL"?[]:ownerOptionsFor(owners,ownerType),[ownerType,owners]);

  useEffect(()=>{void bootstrap();},[]);
  useEffect(()=>{if(!selectedId){setDetail(null);return;} void loadDetail(selectedId);},[selectedId]);
  useEffect(()=>{if(!detail?.currentDraft)return;setForm(toForm(detail.currentDraft));},[detail]);
  useEffect(()=>{if(createOwnerId&&ownerOptions.some(x=>x.id===createOwnerId))return;setCreateOwnerId(ownerOptions[0]?.id??"");},[createOwnerType,ownerOptions,createOwnerId]);

  async function bootstrap(){
    setLoad({status:"loading"});
    try{const catalog=await boApi.learningSyllabusOwners();const list=await authorizedRows(catalog,"ALL","");setOwners(catalog);setRows(list);setSelectedId(list[0]?.syllabus.id??"");const initialType:BoLearningSyllabusOwnerType=catalog.housePaths.length?"HOUSE_PATH":"TOPPI_PROGRAM";setCreateOwnerType(initialType);setCreateOwnerId(ownerOptionsFor(catalog,initialType)[0]?.id??"");setLoad({status:"ready"});}
    catch(e){setLoad(apiLoadError(e));}
  }
  async function refreshRows(nextSelected=selectedId){
    const list=await authorizedRows(owners,ownerType,ownerId);setRows(list);const candidate=list.some(x=>x.syllabus.id===nextSelected)?nextSelected:list[0]?.syllabus.id??"";setSelectedId(candidate);if(candidate===nextSelected&&candidate)await loadDetail(candidate);
  }
  async function applyFilter(type:"ALL"|BoLearningSyllabusOwnerType,id:string){
    setOwnerType(type);setOwnerId(id);setError(null);try{const list=await authorizedRows(owners,type,id);setRows(list);setSelectedId(list[0]?.syllabus.id??"");}catch(e){setError(apiError(e));}
  }
  async function loadDetail(id:string){try{setError(null);setDetail(await boApi.learningSyllabus(id));}catch(e){setError(apiError(e));setDetail(null);}}
  async function run(label:string,action:()=>Promise<unknown>,selected=selectedId){setBusy(label);setError(null);try{await action();await refreshRows(selected);}catch(e){setError(apiError(e));}finally{setBusy("");}}
  async function create(){if(!createOwnerId||!code.trim()||!form.title.trim())return;setBusy("create");setError(null);try{const owner={type:createOwnerType,id:createOwnerId} as BoLearningSyllabusOwner;const created=await boApi.createLearningSyllabus({owner,code:code.trim(),draft:payload(form)});const list=await boApi.learningSyllabi(owner);setOwnerType(createOwnerType);setOwnerId(createOwnerId);setRows(list);setSelectedId(created.syllabus.id);setDetail(created);setCreateOpen(false);setCode("");setForm(blankDraft);}catch(e){setError(apiError(e));}finally{setBusy("");}}
  async function saveDraft(){const draft=detail?.currentDraft;if(!detail||!draft)return;await run("save",()=>boApi.saveLearningSyllabusDraft(detail.syllabus.id,draft.revision,payload(form,draft)));}
  async function publish(){const draft=detail?.currentDraft;if(!detail||!draft)return;if(!confirm(`Publish Syllabus v${draft.versionNumber}? Published versions are immutable.`))return;await run("publish",()=>boApi.publishLearningSyllabusDraft(detail.syllabus.id,draft.revision));}
  async function nextDraft(){if(!detail)return;await run("next",()=>boApi.createNextLearningSyllabusDraft(detail.syllabus.id));}
  async function archive(){if(!detail)return;const reason=prompt("Archive reason");if(!reason?.trim())return;await run("archive",()=>boApi.archiveLearningSyllabus(detail.syllabus.id,detail.syllabus.revision,reason.trim()));}

  if(load.status==="loading")return <State text="Loading canonical Learning Syllabus catalog…"/>;
  if(load.status==="error")return <State text={load.message} requestId={load.requestId} error/>;
  return <section className={`${styles.page} ${styles.syllabusPage}`}>
    <header className={styles.heading}><span>PINO TEAM · LEARNING</span><h1>Syllabus</h1><p>Shared catalog identity for teachable learning units across PINO House and Toppi.</p></header>
    <div className={styles.syllabusBanner}><strong>Publish is catalog-only.</strong><span>Publishing a Syllabus version does not rewrite Sessions, Open Studio Listings, Journey, Content access, or Toppi progression.</span></div>
    {error?<State text={error.message} requestId={error.requestId} error compact/>:null}
    <section className={styles.syllabusWorkspace}>
      <aside className={styles.syllabusDirectory}>
        <div className={styles.syllabusToolbar}><label className={styles.field}>Owner type<select value={ownerType} onChange={e=>{const next=e.target.value as "ALL"|BoLearningSyllabusOwnerType;void applyFilter(next,"");}}><option value="ALL">All</option><option value="HOUSE_PATH">House Path</option><option value="HOUSE_CURRICULUM">House Curriculum</option><option value="TOPPI_PROGRAM">Toppi Program</option></select></label>{ownerType!=="ALL"?<label className={styles.field}>Owner<select value={ownerId} onChange={e=>{setOwnerId(e.target.value);void applyFilter(ownerType,e.target.value);}}><option value="">All {ownerType==="HOUSE_PATH"?"Paths":ownerType==="HOUSE_CURRICULUM"?"Curricula":"Programs"}</option>{filterOptions.map(x=><option key={x.id} value={x.id}>{x.label}</option>)}</select></label>:null}<button className={styles.primaryButton} onClick={()=>{setCreateOpen(x=>!x);setForm(blankDraft);}}>Create Syllabus</button></div>
        {rows.length?rows.map(row=><button key={row.syllabus.id} className={`${styles.syllabusCard} ${selectedId===row.syllabus.id?styles.syllabusCardActive:""}`} onClick={()=>setSelectedId(row.syllabus.id)}><strong>{row.latestPublishedTitle??row.syllabus.code}</strong><span>{ownerLabel(row.syllabus.owner,owners)}</span><small>{row.syllabus.code} · {row.syllabus.lifecycle} · {row.currentDraftVersionNumber?`DRAFT v${row.currentDraftVersionNumber}`:"No draft"}</small></button>):<div className={styles.empty}>No shared Syllabi for this filter.</div>}
      </aside>
      <div className={styles.syllabusDetail}>
        {createOpen?<CreatePanel owners={owners} ownerType={createOwnerType} ownerId={createOwnerId} ownerOptions={ownerOptions} code={code} form={form} busy={busy==="create"} onType={setCreateOwnerType} onOwner={setCreateOwnerId} onCode={setCode} onForm={setForm} onCreate={()=>void create()} onCancel={()=>setCreateOpen(false)}/>:detail?<DetailPanel detail={detail} owners={owners} form={form} busy={busy} onForm={setForm} onSave={()=>void saveDraft()} onPublish={()=>void publish()} onNext={()=>void nextDraft()} onArchive={()=>void archive()}/>:<div className={styles.empty}>Select a Syllabus or create one.</div>}
      </div>
    </section>
  </section>;
}

function CreatePanel(p:{owners:BoLearningSyllabusOwnerCatalog;ownerType:BoLearningSyllabusOwnerType;ownerId:string;ownerOptions:Array<{id:string;label:string}>;code:string;form:DraftForm;busy:boolean;onType:(v:BoLearningSyllabusOwnerType)=>void;onOwner:(v:string)=>void;onCode:(v:string)=>void;onForm:(v:DraftForm)=>void;onCreate:()=>void;onCancel:()=>void}){return <Panel title="Create catalog Syllabus" hint="Identity + initial DRAFT. Subject-specific content stays outside F0."><div className={styles.formGrid}><Field label="Owner type"><select value={p.ownerType} onChange={e=>p.onType(e.target.value as BoLearningSyllabusOwnerType)}><option value="HOUSE_PATH">House Path</option><option value="HOUSE_CURRICULUM">House Curriculum</option><option value="TOPPI_PROGRAM">Toppi Program</option></select></Field><Field label="Owner"><select value={p.ownerId} onChange={e=>p.onOwner(e.target.value)}>{p.ownerOptions.map(x=><option key={x.id} value={x.id}>{x.label}</option>)}</select></Field><Field label="Code"><input value={p.code} onChange={e=>p.onCode(e.target.value)} placeholder="color-harmony"/></Field><DraftFields form={p.form} onChange={p.onForm}/></div><div className={styles.syllabusActions}><button className={styles.primaryButton} disabled={p.busy||!p.ownerId||!p.code.trim()||!p.form.title.trim()} onClick={p.onCreate}>{p.busy?"Creating…":"Create DRAFT"}</button><button className={styles.secondaryButton} onClick={p.onCancel}>Cancel</button></div></Panel>}
function DetailPanel(p:{detail:BoLearningSyllabusDetail;owners:BoLearningSyllabusOwnerCatalog;form:DraftForm;busy:string;onForm:(v:DraftForm)=>void;onSave:()=>void;onPublish:()=>void;onNext:()=>void;onArchive:()=>void}){const {syllabus,currentDraft,latestPublished,versions}=p.detail;return <><Panel title={latestPublished?.title??currentDraft?.title??syllabus.code} hint={`${ownerLabel(syllabus.owner,p.owners)} · ${syllabus.code} · ${syllabus.lifecycle}`}><div className={styles.syllabusMeta}><span>Syllabus ID <code>{syllabus.id}</code></span><span>Revision {syllabus.revision}</span><span>{latestPublished?`Latest PUBLISHED v${latestPublished.versionNumber}`:"Never published"}</span></div>{currentDraft?<><div className={styles.formGrid}><DraftFields form={p.form} onChange={p.onForm}/></div><div className={styles.syllabusActions}><button className={styles.secondaryButton} disabled={Boolean(p.busy)} onClick={p.onSave}>{p.busy==="save"?"Saving…":`Save DRAFT v${currentDraft.versionNumber}`}</button><button className={styles.primaryButton} disabled={Boolean(p.busy)} onClick={p.onPublish}>{p.busy==="publish"?"Publishing…":"Review & Publish"}</button></div></>:syllabus.lifecycle==="ACTIVE"&&latestPublished?<button className={styles.primaryButton} disabled={Boolean(p.busy)} onClick={p.onNext}>{p.busy==="next"?"Creating…":"Create next DRAFT"}</button>:null}{syllabus.lifecycle==="ACTIVE"?<button className={styles.secondaryButton} disabled={Boolean(p.busy)} onClick={p.onArchive}>{p.busy==="archive"?"Archiving…":"Archive with reason"}</button>:null}</Panel>{currentDraft?<SyllabusProfileEditor detail={p.detail} owners={p.owners}/>:null}<Panel title="Version history" hint="Published versions are immutable; DRAFT is the only editable state."><div className={styles.syllabusHistory}>{versions.map(v=><article key={v.id}><div><strong>v{v.versionNumber} · {v.state}</strong><span>{v.title}</span></div><small>{v.state==="PUBLISHED"?`Published ${fmt(v.publishedAt)}`:`Draft revision ${v.revision}`} · {v.id}</small></article>)}</div></Panel></>}
function DraftFields({form,onChange}:{form:DraftForm;onChange:(v:DraftForm)=>void}){const set=(key:keyof DraftForm,value:string)=>onChange({...form,[key]:value});return <><Field label="Title"><input value={form.title} onChange={e=>set("title",e.target.value)}/></Field><Field label="Short description"><input value={form.shortDescription} onChange={e=>set("shortDescription",e.target.value)}/></Field><Field label="Public description"><input value={form.publicDescription} onChange={e=>set("publicDescription",e.target.value)}/></Field><Field label="Tags"><input value={form.tags} onChange={e=>set("tags",e.target.value)} placeholder="foundation, color"/></Field><Field label="Source type"><input value={form.sourceType} onChange={e=>set("sourceType",e.target.value)}/></Field><Field label="Source ref"><input value={form.sourceRef} onChange={e=>set("sourceRef",e.target.value)}/></Field></>}
function Field({label,children}:{label:string;children:React.ReactNode}){return <label className={styles.field}>{label}{children}</label>}
function Panel({title,hint,children}:{title:string;hint:string;children:React.ReactNode}){return <section className={styles.panel}><div className={styles.panelHeading}><div><h2>{title}</h2><p>{hint}</p></div><span className={styles.writePill}>Controlled write</span></div>{children}</section>}
function State({text,requestId,error=false,compact=false}:{text:string;requestId?:string|null;error?:boolean;compact?:boolean}){return <div className={`${styles.state} ${error?styles.errorState:""} ${compact?styles.compactState:""}`} role={error?"alert":undefined}><strong>{error?"Unable to use Learning Syllabus":"Loading"}</strong><span>{text}</span>{requestId?<code>{requestId}</code>:null}</div>}
async function authorizedRows(catalog:BoLearningSyllabusOwnerCatalog,type:"ALL"|BoLearningSyllabusOwnerType,id:string):Promise<BoLearningSyllabusSummary[]>{const ownerList:BoLearningSyllabusOwner[]=id&&type!=="ALL"?[{type,id}]:type==="HOUSE_PATH"?catalog.housePaths.map(x=>({type:"HOUSE_PATH" as const,id:x.id})):type==="HOUSE_CURRICULUM"?catalog.houseCurricula.map(x=>({type:"HOUSE_CURRICULUM" as const,id:x.id})):type==="TOPPI_PROGRAM"?catalog.toppiPrograms.map(x=>({type:"TOPPI_PROGRAM" as const,id:x.id})):[...catalog.housePaths.map(x=>({type:"HOUSE_PATH" as const,id:x.id})),...catalog.houseCurricula.map(x=>({type:"HOUSE_CURRICULUM" as const,id:x.id})),...catalog.toppiPrograms.map(x=>({type:"TOPPI_PROGRAM" as const,id:x.id}))];if(!ownerList.length)return[];return(await Promise.all(ownerList.map(owner=>boApi.learningSyllabi(owner)))).flat().sort((a,b)=>ownerLabel(a.syllabus.owner,catalog).localeCompare(ownerLabel(b.syllabus.owner,catalog))||a.syllabus.code.localeCompare(b.syllabus.code));}
function payload(f:DraftForm,preserve?:NonNullable<BoLearningSyllabusDetail["currentDraft"]>):BoLearningSyllabusDraftInput{return{title:f.title.trim(),shortDescription:f.shortDescription.trim()||null,publicDescription:f.publicDescription.trim()||null,tags:f.tags.split(",").map(x=>x.trim()).filter(Boolean),thumbnailMediaId:preserve?.thumbnailMediaId??null,coverMediaId:preserve?.coverMediaId??null,sourceType:f.sourceType.trim()||null,sourceRef:f.sourceRef.trim()||null,provenance:preserve?.provenance??null};}
function toForm(v:BoLearningSyllabusDetail["currentDraft"] extends infer T?NonNullable<T>:never):DraftForm{return{title:v.title,shortDescription:v.shortDescription??"",publicDescription:v.publicDescription??"",tags:v.tags.join(", "),sourceType:v.sourceType??"",sourceRef:v.sourceRef??""};}
function ownerOptionsFor(catalog:BoLearningSyllabusOwnerCatalog,type:BoLearningSyllabusOwnerType){if(type==="HOUSE_PATH")return catalog.housePaths.map(x=>({id:x.id,label:`${x.displayName} / ${x.code}`}));if(type==="HOUSE_CURRICULUM")return catalog.houseCurricula.map(x=>({id:x.id,label:`${x.code.replaceAll("-"," ")} / curriculum`}));return catalog.toppiPrograms.map(x=>({id:x.id,label:x.code.replaceAll("_"," ")}));}
function ownerLabel(owner:BoLearningSyllabusOwner,catalog:BoLearningSyllabusOwnerCatalog){if(owner.type==="HOUSE_PATH"){const x=catalog.housePaths.find(p=>p.id===owner.id);return x?`House / ${x.displayName}`:`House Path / ${owner.id}`;}if(owner.type==="HOUSE_CURRICULUM"){const x=catalog.houseCurricula.find(p=>p.id===owner.id);return x?`House Curriculum / ${x.code.replaceAll("-"," ")}`:`House Curriculum / ${owner.id}`;}const x=catalog.toppiPrograms.find(p=>p.id===owner.id);return x?`Toppi / ${x.code.replaceAll("_"," ")}`:`Toppi Program / ${owner.id}`;}
function fmt(v:string|null){return v?new Intl.DateTimeFormat("en-GB",{timeZone:"Asia/Ho_Chi_Minh",dateStyle:"medium",timeStyle:"short"}).format(new Date(v)):"—";}
function apiError(e:unknown){return e instanceof BoApiError?{message:e.message,requestId:e.requestId}:{message:e instanceof Error?e.message:"Learning Syllabus operation failed.",requestId:null};}
function apiLoadError(e:unknown):LoadState{const value=apiError(e);return{status:"error",...value};}
