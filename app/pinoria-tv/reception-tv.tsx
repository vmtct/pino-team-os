"use client";

import {useCallback,useEffect,useRef,useState}from"react";
import styles from"./reception-tv.module.css";

type Learner={studentProfileId:string;displayName:string;openVisit:{id:string;checkedInAt:string;version:number}|null};
type Projection={learners:Learner[]};
type Scene={id:string;kind:"arrival"|"departure";name:string};
const CENTER_STORAGE="pino.arrival.centerId";
const layers=[
  "https://assets.pinohouse.art/draft/Char_Wing%20Hollogram.png",
  "https://assets.pinohouse.art/draft/Char_body_painting_girl.png",
  "https://assets.pinohouse.art/draft/Char_hair_girl_short.png",
  "https://assets.pinohouse.art/draft/Char_face_smiley.png",
];
function todayInVietnam(){return new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Ho_Chi_Minh",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());}

export function ReceptionTv(){
  const[centerId,setCenterId]=useState("");
  const[draft,setDraft]=useState("");
  const[connected,setConnected]=useState(false);
  const[events,setEvents]=useState<Scene[]>([]);
  const[inside,setInside]=useState(0);
  const baseline=useRef<Map<string,boolean>|null>(null);

  useEffect(()=>{const query=new URLSearchParams(window.location.search).get("centerId")?.trim()??"";const saved=window.localStorage.getItem(CENTER_STORAGE)?.trim()??"";const value=query||saved;if(value){setCenterId(value);setDraft(value);if(query)window.localStorage.setItem(CENTER_STORAGE,query);}},[]);

  const poll=useCallback(async()=>{
    if(!centerId)return;
    try{
      const date=todayInVietnam();
      const response=await fetch(`/api/tos-learning/arrival-desk?centerId=${encodeURIComponent(centerId)}&localDate=${date}&t=${Date.now()}`,{cache:"no-store"});
      if(!response.ok)throw new Error("offline");
      const json=await response.json() as{data?:Projection};if(!json.data)throw new Error("empty");
      const next=new Map(json.data.learners.map(learner=>[learner.studentProfileId,!!learner.openVisit]));
      setInside(json.data.learners.filter(learner=>learner.openVisit).length);
      if(baseline.current){
        const changes:Scene[]=[];
        for(const learner of json.data.learners){const before=baseline.current.get(learner.studentProfileId)??false,after=!!learner.openVisit;if(before!==after)changes.push({id:`${learner.studentProfileId}-${after?learner.openVisit?.id:"out"}-${Date.now()}`,kind:after?"arrival":"departure",name:learner.displayName});}
        if(changes.length)setEvents(queue=>[...queue,...changes]);
      }
      baseline.current=next;setConnected(true);
    }catch{setConnected(false);}
  },[centerId]);

  useEffect(()=>{if(!centerId)return;void poll();const timer=window.setInterval(()=>void poll(),1500);return()=>window.clearInterval(timer);},[centerId,poll]);
  useEffect(()=>{if(!events.length)return;const timer=window.setTimeout(()=>setEvents(queue=>queue.slice(1)),6500);return()=>window.clearTimeout(timer);},[events]);

  function save(){const value=draft.trim();if(!value)return;window.localStorage.setItem(CENTER_STORAGE,value);baseline.current=null;setCenterId(value);}
  const scene=events[0]??null;

  if(!centerId)return <main className={styles.setup}><div><span>PINORIA · RECEPTION TV</span><h1>Kết nối màn hình</h1><p>Nhập Center ID một lần cho TV lễ tân.</p><input value={draft} onChange={event=>setDraft(event.target.value)} placeholder="Center ID"/><button onClick={save}>Kết nối</button></div></main>;

  return <main className={`${styles.stage} ${scene?styles.active:""}`}>
    <div className={styles.sky}/><div className={styles.orbOne}/><div className={styles.orbTwo}/>
    <header className={styles.status}><div><b>PINORIA</b><span>RECEPTION</span></div><div className={styles.live}><i className={connected?styles.online:styles.offline}/>{connected?`${inside} Piner đang ở House`:"Đang kết nối lại…"}</div></header>
    <div className={styles.sparkles}>{Array.from({length:10},(_,index)=><i key={index} style={{"--i":index}as React.CSSProperties}/>)}</div>
    {scene?<section key={scene.id} className={`${styles.scene} ${scene.kind==="departure"?styles.departure:""}`}>
      <div className={styles.aura}><img src="https://assets.pinohouse.art/draft/AuraLv3.png" alt=""/></div>
      <div className={styles.character}>{layers.map((src,index)=><img key={src} src={src} alt="" style={{zIndex:index+1}}/>)}</div>
      <img className={styles.mori} src="https://assets.pinohouse.art/draft/Mori.png" alt=""/>
      <div className={styles.copy}><span>{scene.kind==="arrival"?"CHÀO ĐẾN PINO HOUSE":"HẸN GẶP LẠI"}</span><h1>{scene.name}</h1><p>{scene.kind==="arrival"?"Một buổi sáng tạo mới đang chờ bạn ✦":"Pinoria sẽ giữ lại những điều đẹp hôm nay ✦"}</p></div>
    </section>:<section className={styles.idle}><div className={styles.sigil}>P</div><span>PINORIA IS LISTENING</span><h1>Chào mừng đến PINO House</h1><p>Mỗi lần một Piner đến, Pinoria sẽ thức dậy.</p></section>}
    <footer><span>{new Date().toLocaleDateString("vi-VN",{timeZone:"Asia/Ho_Chi_Minh",weekday:"long",day:"2-digit",month:"2-digit"})}</span><button onClick={()=>{window.localStorage.removeItem(CENTER_STORAGE);setCenterId("");baseline.current=null;}}>Center</button></footer>
  </main>;
}
