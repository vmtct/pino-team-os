"use client";

import { useEffect, useMemo, useState } from "react";
import { boApi, BoApiError } from "@/lib/bo-api";
import type { BoLearningSyllabusDetail, BoLearningSyllabusOwnerCatalog, BoLearningSyllabusProfileKind, BoSyllabusRichContent } from "@/lib/bo-model";
import type { BoPracticeResourceDetail } from "@/lib/bo-practice-model";
import styles from "../bo.module.css";

type PracticeChoice={resourceId:string;versionId:string;pageId:string;label:string};
type Form={content:string;toolTags:string;worksheets:string;practiceKey:string};
type LoadedProfile={revision:number|null;practiceResourceId?:string;practiceResourceVersionId?:string;practicePageId?:string;richContent?:BoSyllabusRichContent;toolTags?:string[];worksheetMediaIds?:string[]}|null;
const blank:Form={content:"",toolTags:"",worksheets:"",practiceKey:""};

export function SyllabusProfileEditor({detail,owners}:{detail:BoLearningSyllabusDetail;owners:BoLearningSyllabusOwnerCatalog}){
  const draft=detail.currentDraft;
  const kind=profileKind(detail,owners);
  const [form,setForm]=useState<Form>(blank);
  const [profile,setProfile]=useState<LoadedProfile>(null);
  const [choices,setChoices]=useState<PracticeChoice[]>([]);
  const [busy,setBusy]=useState<"load"|"save"|"">("");
  const [error,setError]=useState("");
  const versionId=draft?.id??"";

  // load is intentionally version/kind-bound; callbacks stay local to this editor instance.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(()=>{if(!versionId||!kind)return;void load(versionId,kind);},[versionId,kind]);
  const selected=useMemo(()=>choices.find(x=>choiceKey(x)===form.practiceKey)??null,[choices,form.practiceKey]);

  async function load(id:string,nextKind:BoLearningSyllabusProfileKind){
    setBusy("load");setError("");
    try{
      const raw=nextKind==="ARTCHITECT"?await boApi.artSyllabusProfile(id):nextKind==="PIANOHOUSE"?await boApi.pianoSyllabusProfile(id):await boApi.littlePinerSyllabusProfile(id);
      const value=raw as LoadedProfile;setProfile(value);
      const next={...blank};
      if(value?.richContent)next.content=richText(value.richContent);
      if(value?.toolTags)next.toolTags=value.toolTags.join(", ");
      if(value?.worksheetMediaIds)next.worksheets=value.worksheetMediaIds.join("\n");
      if(value?.practiceResourceId&&value.practiceResourceVersionId&&value.practicePageId)next.practiceKey=[value.practiceResourceId,value.practiceResourceVersionId,value.practicePageId].join("|");
      setForm(next);
      if(nextKind!=="ARTCHITECT")setChoices(await practiceChoices(nextKind));else setChoices([]);
    }catch(e){setError(message(e));}finally{setBusy("");}
  }

  async function practiceChoices(nextKind:BoLearningSyllabusProfileKind){
    const context=await boApi.practiceAuthoringContext();
    const preferred=nextKind==="PIANOHOUSE"?["pianohouse"]:["little-piner-piano","little-piner"];
    let paths=context.paths.filter(path=>preferred.includes(path.code));
    if(!paths.length&&nextKind==="LITTLE_PINER")paths=context.paths.filter(path=>path.code.includes("little-piner"));
    const resources=(await Promise.all(paths.map(path=>boApi.practiceResources(path.id)))).flat();
    return resources.flatMap(resource=>publishedChoices(resource));
  }

  async function save(){
    if(!draft||!kind)return;setBusy("save");setError("");
    try{
      if(kind==="ARTCHITECT")await boApi.saveArtSyllabusProfile(draft.id,{richContent:toRich(form.content),worksheetMediaIds:ids(form.worksheets),toolTags:tags(form.toolTags),expectedRevision:profile?.revision??null});
      else {
        if(!selected)throw new Error("Ch?n m?t published Practice page tr??c khi l?u.");
        const practice={practiceResourceId:selected.resourceId,practiceResourceVersionId:selected.versionId,practicePageId:selected.pageId};
        if(kind==="PIANOHOUSE")await boApi.savePianoSyllabusProfile(draft.id,{...practice,expectedRevision:profile?.revision??null});
        else await boApi.saveLittlePinerSyllabusProfile(draft.id,{...practice,richContent:toRich(form.content),worksheetMediaIds:ids(form.worksheets),toolTags:tags(form.toolTags),expectedRevision:profile?.revision??null});
      }
      await load(draft.id,kind);
    }catch(e){setError(message(e));setBusy("");}
  }

  if(!draft||!kind)return null;
  const needsArt=kind!=="PIANOHOUSE",needsPractice=kind!=="ARTCHITECT";
  const ready=profile!==null;
  return <section className={`${styles.panel} ${styles.syllabusProfilePanel}`}>
    <div className={styles.panelHeading}><div><span className={styles.profileEyebrow}>{label(kind)}</span><h2>Subject content profile</h2><p>{hint(kind)}</p></div><span className={`${styles.profileStatus} ${ready?styles.profileReady:styles.profileDraft}`}>{ready?`Saved ? r${profile?.revision}`:"Profile required"}</span></div>
    {error?<div className={styles.profileError} role="alert">{error}</div>:null}
    {busy==="load"?<div className={styles.empty}>Loading canonical profile?</div>:<div className={styles.profileEditorGrid}>
      {needsArt?<section className={styles.profileBlock}><div className={styles.profileBlockHeading}><strong>{kind==="LITTLE_PINER"?"A / Learning brief":"Learning brief"}</strong><span>Structured rich content</span></div><textarea className={styles.profileContent} value={form.content} onChange={e=>setForm({...form,content:e.target.value})} placeholder="M?c ti?u, flow ho?t ??ng, ti?u ch? ho?n th?nh?" rows={9}/><label className={styles.field}>H?a c? / tool tags<input value={form.toolTags} onChange={e=>setForm({...form,toolTags:e.target.value})} placeholder="Brush, Watercolor, Paper"/></label></section>:null}
      {needsArt?<section className={styles.profileBlock}><div className={styles.profileBlockHeading}><strong>{kind==="LITTLE_PINER"?"B / Worksheets":"Worksheets"}</strong><span>Ordered protected Media references</span></div><textarea className={styles.profileIds} value={form.worksheets} onChange={e=>setForm({...form,worksheets:e.target.value})} placeholder={"1 canonical Media Asset ID per line\n?"} rows={6}/><p className={styles.profileNote}>Th? t? d?ng l? th? t? worksheet canonical. Upload/library ingestion v?n l? packet ri?ng; editor n?y kh?ng t?o shadow asset.</p></section>:null}
      {needsPractice?<section className={`${styles.profileBlock} ${kind==="PIANOHOUSE"?styles.profileBlockWide:""}`}><div className={styles.profileBlockHeading}><strong>{kind==="LITTLE_PINER"?"C / Piano Practice":"Practice relation"}</strong><span>Exact published resource / version / page</span></div><label className={styles.field}>Published Practice page<select value={form.practiceKey} onChange={e=>setForm({...form,practiceKey:e.target.value})}><option value="">Select published page?</option>{choices.map(choice=><option key={choiceKey(choice)} value={choiceKey(choice)}>{choice.label}</option>)}</select></label>{selected?<div className={styles.profileReference}><span>Resource <code>{selected.resourceId}</code></span><span>Version <code>{selected.versionId}</code></span><span>Page <code>{selected.pageId}</code></span></div>:<p className={styles.profileNote}>Only already-published Practice pages are selectable.</p>}</section>:null}
    </div>}
    <div className={styles.profileFooter}><div><strong>{ready?"Profile attached to this exact DRAFT version":"Save once before publishing"}</strong><span>Publishing freezes this profile atomically with Syllabus v{draft.versionNumber}.</span></div><button className={styles.primaryButton} disabled={Boolean(busy)||!canSave(kind,form,selected)} onClick={()=>void save()}>{busy==="save"?"Saving profile?":ready?"Save profile changes":"Attach & save profile"}</button></div>
  </section>;
}

function profileKind(detail:BoLearningSyllabusDetail,owners:BoLearningSyllabusOwnerCatalog):BoLearningSyllabusProfileKind|null{const owner=detail.syllabus.owner;if(owner.type==="HOUSE_PATH"){const code=owners.housePaths.find(x=>x.id===owner.id)?.code;return code==="artchitect"?"ARTCHITECT":code==="pianohouse"?"PIANOHOUSE":null;}if(owner.type==="HOUSE_CURRICULUM"){return owners.houseCurricula.find(x=>x.id===owner.id)?.code==="little-piner"?"LITTLE_PINER":null;}return null;}
function label(kind:BoLearningSyllabusProfileKind){return kind==="ARTCHITECT"?"ARTCHITECT":kind==="PIANOHOUSE"?"PIANOHOUSE":"LITTLE PINER / A+B+C";}
function hint(kind:BoLearningSyllabusProfileKind){return kind==="ARTCHITECT"?"Rich activity content + ordered worksheet assets + H?a c? tags.":kind==="PIANOHOUSE"?"One exact published Practice page relation for this Syllabus version.":"One canonical curriculum unit: A rich brief + B shared worksheets + C exact Piano Practice page.";}
function publishedChoices(resource:BoPracticeResourceDetail):PracticeChoice[]{const version=resource.currentPublished;if(!version)return[];return version.pages.map(page=>({resourceId:resource.id,versionId:version.id,pageId:page.id,label:`${resource.title} / v${version.versionNumber} / Page ${page.order}`}));}
function choiceKey(x:PracticeChoice){return`${x.resourceId}|${x.versionId}|${x.pageId}`;}
function ids(value:string){return value.split(/\r?\n|,/).map(x=>x.trim()).filter(Boolean);}
function tags(value:string){return value.split(",").map(x=>x.trim()).filter(Boolean);}
function toRich(value:string):BoSyllabusRichContent{const paragraphs=value.split(/\n+/).map(x=>x.trim()).filter(Boolean);return{type:"doc",content:paragraphs.map(text=>({type:"paragraph",content:[{type:"text",text}]}))};}
function richText(value:BoSyllabusRichContent){const out:string[]=[];const visit=(node:unknown)=>{if(!node||typeof node!=="object")return;const record=node as Record<string,unknown>;if(typeof record.text==="string")out.push(record.text);if(Array.isArray(record.content)){for(const child of record.content)visit(child);if(record.type==="paragraph")out.push("\n");}};visit(value);return out.join("").replace(/\n{2,}/g,"\n").trim();}
function canSave(kind:BoLearningSyllabusProfileKind,form:Form,selected:PracticeChoice|null){if(kind==="PIANOHOUSE")return Boolean(selected);if(!form.content.trim()||ids(form.worksheets).length===0)return false;return kind==="ARTCHITECT"||Boolean(selected);}
function message(e:unknown){return e instanceof BoApiError?`${e.message}${e.requestId?` ? ${e.requestId}`:""}`:e instanceof Error?e.message:"Unable to save syllabus profile.";}
