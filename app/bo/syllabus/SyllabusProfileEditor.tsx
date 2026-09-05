"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { boApi, BoApiError } from "@/lib/bo-api";
import type { BoLearningSyllabusDetail, BoLearningSyllabusOwnerCatalog, BoLearningSyllabusProfileKind, BoSyllabusRichContent, BoSyllabusWorksheetMedia } from "@/lib/bo-model";
import type { BoPracticeResourceDetail } from "@/lib/bo-practice-model";
import styles from "../bo.module.css";

type PracticeChoice={resourceId:string;versionId:string;pageId:string;label:string};
type Form={content:string;toolTags:string;worksheetIds:string[];practiceKey:string};
type LoadedProfile={revision:number|null;practiceResourceId?:string;practiceResourceVersionId?:string;practicePageId?:string;richContent?:BoSyllabusRichContent;toolTags?:string[];worksheetMediaIds?:string[]}|null;
type UploadState={status:"idle"|"uploading"|"success"|"error";fileName?:string;message?:string};
type UploadReplay={signature:string;key:string;file:File};
const blank:Form={content:"",toolTags:"",worksheetIds:[],practiceKey:""};
const allowedMedia=new Set(["application/pdf","image/png","image/jpeg","image/webp"]);

export function SyllabusProfileEditor({detail,owners}:{detail:BoLearningSyllabusDetail;owners:BoLearningSyllabusOwnerCatalog}){
  const draft=detail.currentDraft,kind=profileKind(detail,owners),versionId=draft?.id??"";
  const [form,setForm]=useState<Form>(blank),[profile,setProfile]=useState<LoadedProfile>(null),[choices,setChoices]=useState<PracticeChoice[]>([]),[library,setLibrary]=useState<BoSyllabusWorksheetMedia[]>([]);
  const [libraryOpen,setLibraryOpen]=useState(false),[libraryQuery,setLibraryQuery]=useState(""),[uploadState,setUploadState]=useState<UploadState>({status:"idle"});
  const uploadReplay=useRef<UploadReplay|null>(null);
  const [busy,setBusy]=useState<"load"|"save"|"">(""),[error,setError]=useState("");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(()=>{if(versionId&&kind)void load(versionId,kind);},[versionId,kind]);
  const selected=useMemo(()=>choices.find(x=>choiceKey(x)===form.practiceKey)??null,[choices,form.practiceKey]);
  const mediaById=useMemo(()=>new Map(library.map(item=>[item.mediaAssetId,item])),[library]);
  const missingMedia=useMemo(()=>form.worksheetIds.filter(id=>!mediaById.has(id)),[form.worksheetIds,mediaById]);
  const filteredLibrary=useMemo(()=>{const q=libraryQuery.trim().toLocaleLowerCase("vi");return q?library.filter(item=>`${item.fileName??""} ${item.mimeType} ${item.mediaAssetId}`.toLocaleLowerCase("vi").includes(q)):library;},[library,libraryQuery]);

  async function load(id:string,nextKind:BoLearningSyllabusProfileKind){
    setBusy("load");setError("");setUploadState({status:"idle"});uploadReplay.current=null;
    try{
      const profileRequest=nextKind==="ARTCHITECT"?boApi.artSyllabusProfile(id):nextKind==="PIANOHOUSE"?boApi.pianoSyllabusProfile(id):boApi.littlePinerSyllabusProfile(id);
      const [raw,media]=await Promise.all([profileRequest,nextKind==="PIANOHOUSE"?Promise.resolve([]):boApi.syllabusWorksheetMedia()]);
      const value=raw as LoadedProfile;setProfile(value);setLibrary(media);
      const next:Form={...blank,worksheetIds:value?.worksheetMediaIds?[...value.worksheetMediaIds]:[]};
      if(value?.richContent)next.content=richText(value.richContent);if(value?.toolTags)next.toolTags=value.toolTags.join(", ");
      if(value?.practiceResourceId&&value.practiceResourceVersionId&&value.practicePageId)next.practiceKey=[value.practiceResourceId,value.practiceResourceVersionId,value.practicePageId].join("|");
      setForm(next);setChoices(nextKind!=="ARTCHITECT"?await practiceChoices(nextKind):[]);
    }catch(e){setError(message(e));}finally{setBusy("");}
  }
  async function practiceChoices(nextKind:BoLearningSyllabusProfileKind){
    const context=await boApi.practiceAuthoringContext(),preferred=nextKind==="PIANOHOUSE"?["pianohouse"]:["little-piner-piano","little-piner"];
    let paths=context.paths.filter(path=>preferred.includes(path.code));if(!paths.length&&nextKind==="LITTLE_PINER")paths=context.paths.filter(path=>path.code.includes("little-piner"));
    return(await Promise.all(paths.map(path=>boApi.practiceResources(path.id)))).flat().flatMap(resource=>publishedChoices(resource));
  }
  async function save(){
    if(!draft||!kind)return;setBusy("save");setError("");
    try{
      if(kind==="ARTCHITECT")await boApi.saveArtSyllabusProfile(draft.id,{richContent:toRich(form.content),worksheetMediaIds:form.worksheetIds,toolTags:tags(form.toolTags),expectedRevision:profile?.revision??null});
      else{if(!selected)throw new Error("Chọn một published Practice page trước khi lưu.");const practice={practiceResourceId:selected.resourceId,practiceResourceVersionId:selected.versionId,practicePageId:selected.pageId};if(kind==="PIANOHOUSE")await boApi.savePianoSyllabusProfile(draft.id,{...practice,expectedRevision:profile?.revision??null});else await boApi.saveLittlePinerSyllabusProfile(draft.id,{...practice,richContent:toRich(form.content),worksheetMediaIds:form.worksheetIds,toolTags:tags(form.toolTags),expectedRevision:profile?.revision??null});}
      await load(draft.id,kind);
    }catch(e){setError(message(e));setBusy("");}
  }
  function addWorksheet(id:string){setForm(current=>current.worksheetIds.includes(id)||current.worksheetIds.length>=20?current:{...current,worksheetIds:[...current.worksheetIds,id]});}
  function removeWorksheet(id:string){setForm(current=>({...current,worksheetIds:current.worksheetIds.filter(value=>value!==id)}));}
  function moveWorksheet(index:number,direction:-1|1){setForm(current=>{const target=index+direction;if(target<0||target>=current.worksheetIds.length)return current;const ids=[...current.worksheetIds];[ids[index],ids[target]]=[ids[target]!,ids[index]!];return{...current,worksheetIds:ids};});}
  async function uploadWorksheet(file:File){
    if(!allowedMedia.has(file.type)){setUploadState({status:"error",fileName:file.name,message:"Chỉ hỗ trợ PDF, PNG, JPEG hoặc WebP."});return;}
    const signature=`${file.name}:${file.type}:${file.size}:${file.lastModified}`;if(uploadReplay.current?.signature!==signature)uploadReplay.current={signature,key:crypto.randomUUID(),file};else uploadReplay.current={...uploadReplay.current,file};
    setUploadState({status:"uploading",fileName:file.name,message:"Đang upload vào canonical Media…"});
    try{const media=await boApi.uploadSyllabusWorksheetMedia(file,uploadReplay.current.key);setLibrary(current=>[media,...current.filter(item=>item.mediaAssetId!==media.mediaAssetId)]);addWorksheet(media.mediaAssetId);uploadReplay.current=null;setUploadState({status:"success",fileName:file.name,message:"Upload xong và đã thêm vào worksheet order."});}
    catch(cause){setUploadState({status:"error",fileName:file.name,message:message(cause)});}
  }
  function retryUpload(){const pending=uploadReplay.current;if(pending)void uploadWorksheet(pending.file);}

  if(!draft||!kind)return null;
  const needsArt=kind!=="PIANOHOUSE",needsPractice=kind!=="ARTCHITECT",ready=profile!==null;
  return <section className={`${styles.panel} ${styles.syllabusProfilePanel}`}>
    <div className={styles.panelHeading}><div><span className={styles.profileEyebrow}>{label(kind)}</span><h2>Subject content profile</h2><p>{hint(kind)}</p></div><span className={`${styles.profileStatus} ${ready?styles.profileReady:styles.profileDraft}`}>{ready?`Saved · r${profile?.revision}`:"Profile required"}</span></div>
    {error?<div className={styles.profileError} role="alert">{error}</div>:null}
    {busy==="load"?<div className={styles.empty}>Loading canonical profile…</div>:<div className={styles.profileEditorGrid}>
      {needsArt?<section className={styles.profileBlock}><div className={styles.profileBlockHeading}><strong>{kind==="LITTLE_PINER"?"A / Learning brief":"Learning brief"}</strong><span>Structured rich content</span></div><textarea className={styles.profileContent} value={form.content} onChange={e=>setForm({...form,content:e.target.value})} placeholder="Mục tiêu, flow hoạt động, tiêu chí hoàn thành…" rows={10}/><label className={styles.field}>Họa cụ / tool tags<input value={form.toolTags} onChange={e=>setForm({...form,toolTags:e.target.value})} placeholder="Brush, Watercolor, Paper"/></label></section>:null}
      {needsArt?<section className={`${styles.profileBlock} ${styles.worksheetBlock}`}><div className={styles.profileBlockHeading}><strong>{kind==="LITTLE_PINER"?"B / Worksheets":"Worksheets"}</strong><span>{form.worksheetIds.length}/20 · ordered</span></div>
        <div className={styles.worksheetToolbar}><label className={`${styles.secondaryButton} ${styles.mediaUploadButton}`}>{uploadState.status==="uploading"?"Uploading…":"Upload file"}<input type="file" accept="application/pdf,image/png,image/jpeg,image/webp" disabled={uploadState.status==="uploading"||Boolean(busy)} onChange={e=>{const file=e.target.files?.[0];if(file)void uploadWorksheet(file);e.currentTarget.value="";}}/></label><button className={styles.secondaryButton} type="button" disabled={Boolean(busy)} onClick={()=>setLibraryOpen(open=>!open)}>{libraryOpen?"Close Media Library":"Choose from Media Library"}</button></div>
        {uploadState.status!=="idle"?<div className={`${styles.uploadState} ${uploadState.status==="error"?styles.uploadStateError:uploadState.status==="success"?styles.uploadStateSuccess:""}`} role={uploadState.status==="error"?"alert":"status"}><div><strong>{uploadState.fileName}</strong><span>{uploadState.message}</span></div>{uploadState.status==="error"&&uploadReplay.current?<button type="button" className={styles.secondaryButton} onClick={retryUpload}>Retry upload</button>:null}</div>:null}
        {libraryOpen?<div className={styles.mediaLibrary}><div className={styles.mediaLibraryHead}><div><strong>Media Library</strong><span>Core-valid protected worksheet assets only</span></div><input aria-label="Search Media Library" value={libraryQuery} onChange={e=>setLibraryQuery(e.target.value)} placeholder="Search filename, MIME or ID"/></div><div className={styles.mediaLibraryGrid}>{filteredLibrary.length?filteredLibrary.map(item=><MediaLibraryItem key={item.mediaAssetId} item={item} selected={form.worksheetIds.includes(item.mediaAssetId)} onAdd={()=>addWorksheet(item.mediaAssetId)}/>):<div className={styles.empty}>No selectable worksheet media.</div>}</div></div>:null}
        {missingMedia.length?<div className={styles.profileError} role="alert">{missingMedia.length} worksheet reference(s) are not available in the current canonical Media Library. Remove or replace them before publish.</div>:null}
        <div className={styles.worksheetList}>{form.worksheetIds.length?form.worksheetIds.map((id,index)=><WorksheetRow key={id} mediaAssetId={id} item={mediaById.get(id)??null} index={index} count={form.worksheetIds.length} disabled={Boolean(busy)||uploadState.status==="uploading"} onMove={direction=>moveWorksheet(index,direction)} onRemove={()=>removeWorksheet(id)}/>):<div className={styles.worksheetEmpty}><strong>No worksheets yet</strong><span>Upload a file or choose an existing canonical Media asset. No UUID paste required.</span></div>}</div>
      </section>:null}
      {needsPractice?<section className={`${styles.profileBlock} ${kind==="PIANOHOUSE"?styles.profileBlockWide:""}`}><div className={styles.profileBlockHeading}><strong>{kind==="LITTLE_PINER"?"C / Piano Practice":"Practice relation"}</strong><span>Exact published resource / version / page</span></div><label className={styles.field}>Published Practice page<select value={form.practiceKey} onChange={e=>setForm({...form,practiceKey:e.target.value})}><option value="">Select published page…</option>{choices.map(choice=><option key={choiceKey(choice)} value={choiceKey(choice)}>{choice.label}</option>)}</select></label>{selected?<div className={styles.profileReference}><span>Resource <code>{selected.resourceId}</code></span><span>Version <code>{selected.versionId}</code></span><span>Page <code>{selected.pageId}</code></span></div>:<p className={styles.profileNote}>Only already-published Practice pages are selectable. This picker is unchanged from PSP-PIANO.</p>}</section>:null}
    </div>}
    <div className={styles.profileFooter}><div><strong>{ready?"Profile attached to this exact DRAFT version":"Save once before publishing"}</strong><span>Publishing freezes this profile atomically with Syllabus v{draft.versionNumber}.</span></div><button className={styles.primaryButton} disabled={Boolean(busy)||uploadState.status==="uploading"||missingMedia.length>0||!canSave(kind,form,selected)} onClick={()=>void save()}>{busy==="save"?"Saving profile…":ready?"Save profile changes":"Attach & save profile"}</button></div>
  </section>;
}

function MediaLibraryItem({item,selected,onAdd}:{item:BoSyllabusWorksheetMedia;selected:boolean;onAdd:()=>void}){return <article className={styles.mediaLibraryCard}><MediaPreview item={item}/><div><strong>{mediaLabel(item)}</strong><span>{item.mimeType} · {formatBytes(item.byteSize)}</span><code>{shortId(item.mediaAssetId)}</code></div><button type="button" className={styles.secondaryButton} disabled={selected} onClick={onAdd}>{selected?"Selected":"Add worksheet"}</button></article>;}
function WorksheetRow({mediaAssetId,item,index,count,disabled,onMove,onRemove}:{mediaAssetId:string;item:BoSyllabusWorksheetMedia|null;index:number;count:number;disabled:boolean;onMove:(direction:-1|1)=>void;onRemove:()=>void}){return <article className={styles.worksheetRow}><div className={styles.worksheetOrder}>{index+1}</div><div className={styles.worksheetPreview}>{item?<MediaPreview item={item}/>:<div className={styles.mediaUnavailable}>Preview unavailable</div>}</div><div className={styles.worksheetMeta}><strong>{item?mediaLabel(item):"Unavailable canonical worksheet"}</strong><span>{item?`${item.mimeType} · ${formatBytes(item.byteSize)}`:"Not present in current selectable library"}</span><code>{mediaAssetId}</code><a href={boApi.syllabusWorksheetPreviewUrl(mediaAssetId)} target="_blank" rel="noreferrer">Open protected preview</a></div><div className={styles.worksheetActions}><button type="button" className={styles.secondaryButton} disabled={disabled||index===0} onClick={()=>onMove(-1)} aria-label={`Move worksheet ${index+1} up`}>↑</button><button type="button" className={styles.secondaryButton} disabled={disabled||index===count-1} onClick={()=>onMove(1)} aria-label={`Move worksheet ${index+1} down`}>↓</button><button type="button" className={styles.removeWorksheetButton} disabled={disabled} onClick={onRemove}>Remove</button></div></article>;}
function MediaPreview({item}:{item:BoSyllabusWorksheetMedia}){
  const url=boApi.syllabusWorksheetPreviewUrl(item.mediaAssetId);
  if(item.mimeType==="application/pdf")return <iframe className={styles.mediaPreviewFrame} src={url} title={`${mediaLabel(item)} PDF preview`} loading="lazy"/>;
  // eslint-disable-next-line @next/next/no-img-element
  return <img className={styles.mediaPreviewFrame} src={url} alt={`${mediaLabel(item)} preview`} loading="lazy"/>;
}
function mediaLabel(item:BoSyllabusWorksheetMedia){return item.fileName?.trim()||`Worksheet ${shortId(item.mediaAssetId)}`;}
function shortId(value:string){return value.length>12?`${value.slice(0,8)}…${value.slice(-4)}`:value;}
function formatBytes(value:number|null){if(value===null)return"size unknown";if(value<1024)return`${value} B`;if(value<1024*1024)return`${(value/1024).toFixed(1)} KB`;return`${(value/(1024*1024)).toFixed(1)} MB`;}
function profileKind(detail:BoLearningSyllabusDetail,owners:BoLearningSyllabusOwnerCatalog):BoLearningSyllabusProfileKind|null{const owner=detail.syllabus.owner;if(owner.type==="HOUSE_PATH"){const code=owners.housePaths.find(x=>x.id===owner.id)?.code;return code==="artchitect"?"ARTCHITECT":code==="pianohouse"?"PIANOHOUSE":null;}if(owner.type==="HOUSE_CURRICULUM")return owners.houseCurricula.find(x=>x.id===owner.id)?.code==="little-piner"?"LITTLE_PINER":null;return null;}
function label(kind:BoLearningSyllabusProfileKind){return kind==="ARTCHITECT"?"ARTCHITECT":kind==="PIANOHOUSE"?"PIANOHOUSE":"LITTLE PINER / A+B+C";}
function hint(kind:BoLearningSyllabusProfileKind){return kind==="ARTCHITECT"?"Rich activity content + ordered worksheet assets + Họa cụ tags.":kind==="PIANOHOUSE"?"One exact published Practice page relation for this Syllabus version.":"One canonical curriculum unit: A rich brief + B shared worksheets + C exact Piano Practice page.";}
function publishedChoices(resource:BoPracticeResourceDetail):PracticeChoice[]{const version=resource.currentPublished;if(!version)return[];return version.pages.map(page=>({resourceId:resource.id,versionId:version.id,pageId:page.id,label:`${resource.title} / v${version.versionNumber} / Page ${page.order}`}));}
function choiceKey(x:PracticeChoice){return`${x.resourceId}|${x.versionId}|${x.pageId}`;}
function tags(value:string){return value.split(",").map(x=>x.trim()).filter(Boolean);}
function toRich(value:string):BoSyllabusRichContent{const paragraphs=value.split(/\n+/).map(x=>x.trim()).filter(Boolean);return{type:"doc",content:paragraphs.map(text=>({type:"paragraph",content:[{type:"text",text}]}))};}
function richText(value:BoSyllabusRichContent){const out:string[]=[];const visit=(node:unknown)=>{if(!node||typeof node!=="object")return;const record=node as Record<string,unknown>;if(typeof record.text==="string")out.push(record.text);if(Array.isArray(record.content)){for(const child of record.content)visit(child);if(record.type==="paragraph")out.push("\n");}};visit(value);return out.join("").replace(/\n{2,}/g,"\n").trim();}
function canSave(kind:BoLearningSyllabusProfileKind,form:Form,selected:PracticeChoice|null){if(kind==="PIANOHOUSE")return Boolean(selected);if(!form.content.trim()||form.worksheetIds.length===0)return false;return kind==="ARTCHITECT"||Boolean(selected);}
function message(e:unknown){return e instanceof BoApiError?`${e.message}${e.requestId?` · ${e.requestId}`:""}`:e instanceof Error?e.message:"Unable to save syllabus profile.";}
