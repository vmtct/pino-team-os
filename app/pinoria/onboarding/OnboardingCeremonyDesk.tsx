"use client";

import {useCallback,useEffect,useMemo,useState} from "react";
import {TosShell} from "@/app/components/tos-shell/TosShell";
import {TOS_PINORIA_FOOTER} from "@/app/components/tos-shell/navigation";
import styles from "./onboarding.module.css";

type Envelope<T>={data?:T;error?:{code?:string;message?:string}};
type Recipient={grantId:string;pinoriaSelfId:string;attempt:number;reason:"INITIAL"|"MANUAL_RERUN";recipientType:"STUDENT"|"STAFF";displayName:string};
type StarterMember={variantId:string;displayName:string;slot:string|null;assetKey:string;renderMode:string;renderMetadata:Record<string,unknown>;sortOrder:number};
type StarterSet={id:string;displayName:string;version:number;webmAssetKey:string|null;members:StarterMember[];slots:Record<string,string|null>};
type Session={id:string;grantId:string;pinoriaSelfId:string;centerId:string;status:"OPEN"|"COMMITTED"|"CANCELLED"|"EXPIRED";selectedSet:StarterSet|null;selectedSetVersion:number|null;selectionStale:boolean;openedAt:string;expiresAt:string;characterId:string|null;presentationId:string|null;committedAt:string|null;version:number};
type CommitResult={sessionId:string;characterId:string;presentationId:string;setId:string;setVersion:number;version:number;committedAt:string};

const CENTER_STORAGE="pino.arrival.centerId";

async function request<T>(path:string,init?:RequestInit){
  const response=await fetch(`/api/tos-learning/${path}`,{cache:"no-store",...init});
  const json=await response.json() as Envelope<T>;
  if(!response.ok||json.data===undefined)throw new Error(json.error?.message??"Onboarding Ceremony unavailable");
  return json.data;
}

export function OnboardingCeremonyDesk(){
  const[centerId,setCenterId]=useState("");
  const[recipients,setRecipients]=useState<Recipient[]>([]);
  const[sets,setSets]=useState<StarterSet[]>([]);
  const[selectedRecipient,setSelectedRecipient]=useState<Recipient|null>(null);
  const[session,setSession]=useState<Session|null>(null);
  const[committed,setCommitted]=useState<CommitResult|null>(null);
  const[busy,setBusy]=useState("");
  const[error,setError]=useState("");
  const[message,setMessage]=useState("");

  useEffect(()=>{
    let active=true;
    async function boot(){
      try{
        const urlCenter=new URLSearchParams(location.search).get("centerId")?.trim();
        const saved=localStorage.getItem(CENTER_STORAGE)?.trim();
        const value=urlCenter||saved||"";
        if(!value)throw new Error("Chưa có Center context. Vào Pinoria Hiện diện trước để chọn Center.");
        if(!active)return;
        setCenterId(value);
        localStorage.setItem(CENTER_STORAGE,value);
      }catch(cause){if(active)setError(cause instanceof Error?cause.message:"Không khởi tạo được ceremony");}
    }
    void boot();return()=>{active=false;};
  },[]);

  const reload=useCallback(async()=>{
    if(!centerId)return;
    try{
      const[recipientData,setData]=await Promise.all([
        request<Recipient[]>(`pinoria/onboarding/recipients?centerId=${encodeURIComponent(centerId)}`),
        request<StarterSet[]>(`pinoria/onboarding/sets?centerId=${encodeURIComponent(centerId)}`),
      ]);
      setRecipients(recipientData);setSets(setData);setError("");
    }catch(cause){setError(cause instanceof Error?cause.message:"Không tải được ceremony context");}
  },[centerId]);

  useEffect(()=>{void reload();},[reload]);

  const selectedSet=useMemo(()=>session?.selectedSet??null,[session]);

  async function chooseRecipient(recipient:Recipient){
    setBusy(`recipient:${recipient.pinoriaSelfId}`);setError("");setMessage("");setCommitted(null);
    try{
      const next=await request<Session>("pinoria/onboarding/sessions",{method:"POST",headers:{"content-type":"application/json","idempotency-key":crypto.randomUUID()},body:JSON.stringify({centerId,pinoriaSelfId:recipient.pinoriaSelfId})});
      setSelectedRecipient(recipient);setSession(next);
      setMessage("Ceremony đã mở. Chọn Starter Set để đồng bộ preview lên Pinoria TV.");
    }catch(cause){setError(cause instanceof Error?cause.message:"Không mở được ceremony");}
    finally{setBusy("");}
  }

  async function chooseSet(set:StarterSet){
    if(!session)return;
    setBusy(`set:${set.id}`);setError("");setMessage("");
    try{
      const next=await request<Session>(`pinoria/onboarding/sessions/${session.id}/select`,{method:"POST",headers:{"content-type":"application/json","idempotency-key":crypto.randomUUID()},body:JSON.stringify({centerId,setId:set.id,expectedVersion:session.version})});
      setSession(next);
      setMessage("Preview đã publish cho Pinoria TV của Center. Kiểm tra màn hình trước khi trao nhân vật.");
    }catch(cause){setError(cause instanceof Error?cause.message:"Không chọn được Starter Set");}
    finally{setBusy("");}
  }

  async function commit(){
    if(!session||!selectedSet||session.selectionStale)return;
    setBusy("commit");setError("");setMessage("");
    try{
      const result=await request<CommitResult>(`pinoria/onboarding/sessions/${session.id}/commit`,{method:"POST",headers:{"content-type":"application/json","idempotency-key":crypto.randomUUID()},body:JSON.stringify({centerId,expectedVersion:session.version})});
      setCommitted(result);
      setSession(current=>current?{...current,status:"COMMITTED",characterId:result.characterId,presentationId:result.presentationId,committedAt:result.committedAt}:current);
      setMessage("Đã trao Character. Grant đã tự động consume; Pinoria TV đang chạy reveal.");
      await reload();
    }catch(cause){setError(cause instanceof Error?cause.message:"Không hoàn tất được ceremony");}
    finally{setBusy("");}
  }

  function reset(){
    setSelectedRecipient(null);setSession(null);setCommitted(null);setMessage("");setError("");
    void reload();
  }

  return <TosShell title="Pinoria Onboarding" subtitle="Starter Character Ceremony · one-time by design" theme="pinoria" footerItems={TOS_PINORIA_FOOTER} activeFooterId="onboarding">
    <main className={styles.page}>
      <section className={styles.hero}>
        <div><span>PNR-ONB · STARTER CEREMONY</span><h1>Trao nhân vật đầu tiên</h1><p>BO cấp quyền một lần → TOS chọn Starter Set → Pinoria TV preview đúng lựa chọn → confirm mới materialize Character.</p></div>
        <a className={styles.tvLink} href="/tv" target="_blank" rel="noreferrer">Mở Pinoria TV ↗</a>
      </section>
      {error?<div className={styles.error}>{error}</div>:null}
      {message?<div className={styles.notice}>{message}</div>:null}

      <section className={styles.steps}>
        <article data-active={!selectedRecipient}>
          <span>01</span><div><b>Chọn người nhận</b><small>Chỉ hiện Self đang ở House và có AVAILABLE grant.</small></div>
        </article>
        <article data-active={Boolean(selectedRecipient&&!selectedSet)}>
          <span>02</span><div><b>Chọn Starter Set</b><small>Hair + Face + Outfit; WEBM là optional.</small></div>
        </article>
        <article data-active={Boolean(selectedSet&&!committed)}>
          <span>03</span><div><b>Trao Character</b><small>Commit atomic, grant tự tắt sau thành công.</small></div>
        </article>
      </section>

      {!selectedRecipient?<section className={styles.panel}>
        <header><div><span>ELIGIBLE NOW</span><h2>Ai được onboard?</h2></div><button onClick={()=>void reload()} disabled={!!busy}>Làm mới</button></header>
        <div className={styles.grid}>
          {recipients.map(recipient=><button key={recipient.pinoriaSelfId} className={styles.card} disabled={!!busy} onClick={()=>void chooseRecipient(recipient)}>
            <i>{recipient.recipientType==="STAFF"?"S":"P"}</i><div><b>{recipient.displayName}</b><small>{recipient.recipientType==="STAFF"?"Staff":"Student"} · Attempt #{recipient.attempt}{recipient.reason==="MANUAL_RERUN"?" · rerun":""}</small></div><span>›</span>
          </button>)}
          {!recipients.length?<div className={styles.empty}><b>Chưa có ceremony grant khả dụng</b><span>Bật “Allow onboarding ceremony” ở BO Student/Staff detail trước.</span></div>:null}
        </div>
      </section>:null}

      {selectedRecipient&&!committed?<section className={styles.panel}>
        <header><div><span>RECIPIENT</span><h2>{selectedRecipient.displayName}</h2><p>{selectedRecipient.recipientType} · Attempt #{selectedRecipient.attempt}</p></div><button onClick={reset} disabled={!!busy}>Đổi người</button></header>
        <div className={styles.setGrid}>
          {sets.map(set=><button key={set.id} className={styles.setCard} data-selected={selectedSet?.id===set.id} disabled={!!busy} onClick={()=>void chooseSet(set)}>
            <div className={styles.setPreview}>
              {set.webmAssetKey?<video src={assetUrl(set.webmAssetKey)??undefined} autoPlay muted loop playsInline/>:<LayerPreview set={set}/>}
            </div>
            <div><b>{set.displayName}</b><small>v{set.version} · {set.webmAssetKey?"WEBM + fallback":"Layered fallback"}</small></div>
          </button>)}
        </div>
        {session?.selectionStale?<div className={styles.warning}><b>Starter Set đã thay đổi version</b><span>Chọn lại Set trước khi trao Character để TV và commit cùng exact version.</span></div>:null}
        {selectedSet?<div className={styles.commitBar}>
          <div><span>TV PREVIEW</span><b>{selectedSet.displayName} · v{session?.selectedSetVersion}</b><small>{session?.selectionStale?"Selection stale — reselect required":"Selection synced qua canonical ceremony session."}</small></div>
          <button disabled={busy==="commit"||Boolean(session?.selectionStale)} onClick={()=>void commit()}>{busy==="commit"?"Đang trao…":"Bắt đầu hành trình ✦"}</button>
        </div>:null}
      </section>:null}

      {committed&&selectedRecipient?<section className={styles.success}>
        <span>CHARACTER GRANTED</span><h2>Chào mừng {selectedRecipient.displayName} đến Pinoria ✦</h2><p>Character <code>{committed.characterId}</code> đã materialize. Ceremony grant đã consume và lịch sử attempt được giữ nguyên.</p>
        <button onClick={reset}>Xong · về danh sách</button>
      </section>:null}
    </main>
  </TosShell>;
}

function LayerPreview({set}:{set:StarterSet}){
  return <div className={styles.layers}>{set.members.filter(member=>member.slot&&["HEAD/HAIR","FACE","HEADWEAR","OUTFIT","BACK"].includes(member.slot)).sort((a,b)=>Number(a.renderMetadata.zIndex??0)-Number(b.renderMetadata.zIndex??0)).map(member=><img key={member.variantId} src={assetUrl(member.assetKey)??undefined} alt="" style={{zIndex:Number(member.renderMetadata.zIndex??20)}}/> )}</div>;
}
function assetUrl(value:string|null){if(!value)return null;return /^https?:\/\//i.test(value)?value:`https://assets.pinohouse.art/${value.replace(/^\/+/, "")}`;}
