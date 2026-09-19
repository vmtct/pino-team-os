"use client";

import{useMemo,useState}from"react";
import{PINORIA_EXPERIENCE_STAGES,type PinoriaExperienceLoadResult,type PinoriaExperienceScene,type PinoriaExperienceStageId}from"../../lib/pinoria-experience-contract";
import styles from"./pinoria-lab.module.css";

export function PinoriaLab({result}:{result:PinoriaExperienceLoadResult}){
  if(result.state!=="ready")return <main className={styles.page}><section className={styles.main}><div className={styles.focus}><div className={styles.eyebrow}>PINORIA LAB</div><h2>Experience projection chưa sẵn sàng</h2><p>{result.reason}</p></div></section></main>;
  return <Experience scene={result.scene} source={result.source}/>;
}

function Experience({scene,source}:{scene:PinoriaExperienceScene;source:"fixture"|"core-projection"}){
  const[stage,setStage]=useState<PinoriaExperienceStageId>(PINORIA_EXPERIENCE_STAGES[0].id);
  const[selectedChoice,setSelectedChoice]=useState(scene.quickChoice.options[0]?.id??"");
  const index=useMemo(()=>Math.max(0,PINORIA_EXPERIENCE_STAGES.findIndex(item=>item.id===stage)),[stage]);
  const meta=PINORIA_EXPERIENCE_STAGES[index]??PINORIA_EXPERIENCE_STAGES[0];
  function move(offset:number){const next=PINORIA_EXPERIENCE_STAGES[index+offset];if(next)setStage(next.id);}

  return <main className={styles.page}>
    <aside className={styles.rail}>
      <div className={styles.brand}>PINORIA</div><div className={styles.lab}>EXPERIENCE LAB</div>
      <section className={styles.learner}><div className={styles.avatar}>{scene.learner.avatarText}</div><div><strong>{scene.learner.displayName}</strong><small>Arrival context: đã đến House</small></div></section>
      <nav className={styles.stages} aria-label="Pinoria future experience stages">
        {PINORIA_EXPERIENCE_STAGES.map((item,itemIndex)=><button key={item.id} type="button" onClick={()=>setStage(item.id)} className={`${styles.stageButton} ${stage===item.id?styles.stageButtonActive:""}`} aria-current={stage===item.id?"step":undefined}><b>{String(itemIndex+1).padStart(2,"0")}</b><span>{item.label}</span></button>)}
      </nav>
      <div className={styles.railNote}>Lab chỉ thay đổi presentation state trong browser. Không có command tới Core, không ghi ledger, inventory, companion hay world state.</div>
    </aside>

    <section className={styles.main}>
      <header className={styles.topbar}><div><div className={styles.eyebrow}>{meta.eyebrow}</div><strong>{meta.label}</strong></div><div>{source==="fixture"?<span className={styles.fixture}>FIXTURE · NOT CANONICAL</span>:null}</div><div className={styles.fixture}>{index+1}/{PINORIA_EXPERIENCE_STAGES.length}</div></header>
      <Stage scene={scene} stage={stage} selectedChoice={selectedChoice} onChoice={setSelectedChoice}/>
      <div className={styles.footerNav}><button className={styles.previous} type="button" disabled={index===0} onClick={()=>move(-1)}>← Trước</button><button className={styles.next} type="button" disabled={index===PINORIA_EXPERIENCE_STAGES.length-1} onClick={()=>move(1)}>Tiếp theo →</button></div>
    </section>
  </main>;
}

function Stage({scene,stage,selectedChoice,onChoice}:{scene:PinoriaExperienceScene;stage:PinoriaExperienceStageId;selectedChoice:string;onChoice:(id:string)=>void}){
  if(stage==="quick-choice")return <><section className={styles.hero}><span className={styles.stageIndex}>ARRIVAL → QUICK CHOICE</span><div><div className={styles.eyebrow}>ARRIVAL ĐÃ XẢY RA</div><h1>{scene.quickChoice.prompt}</h1><p>{scene.arrival.note}</p></div><p>Chọn ở đây chỉ thay presentation path của prototype; không ghi choice xuống Core.</p></section><div className={styles.grid}>{scene.quickChoice.options.map(option=><button type="button" key={option.id} className={`${styles.card} ${styles.cardInteractive} ${selectedChoice===option.id?styles.selected:""}`} onClick={()=>onChoice(option.id)}><div className={styles.eyebrow}>OPTION</div><h3>{option.title}</h3><p className={styles.cardNote}>{option.note}</p><span className={styles.cardTag}>{selectedChoice===option.id?"Đang chọn":"Presentation only"}</span></button>)}</div></>;

  if(stage==="session")return <><section className={styles.hero}><span className={styles.stageIndex}>SESSION SCENE</span><div><div className={styles.eyebrow}>BUỔI HÔM NAY</div><h1>{scene.session.title}</h1><p>Focus được trình bày để learner/staff hiểu buổi hôm nay, không dùng scene này làm Attendance hoặc Participation truth.</p></div></section><section className={styles.focus}><div className={styles.eyebrow}>CURRENT FOCUS</div><h2>{scene.session.focus}</h2><p>{scene.session.facilitatorCue}</p></section></>;

  if(stage==="rewards")return <><section className={styles.hero}><span className={styles.stageIndex}>REWARD PRESENTATION</span><div><div className={styles.eyebrow}>REWARDS</div><h1>{scene.rewards.headline}</h1><p>Không có balance/ledger mutation trong Lab. Các con số dưới đây là fixture để khóa UX.</p></div></section><div className={styles.grid}>{scene.rewards.items.map(item=><article className={styles.card} key={item.id}><div className={styles.eyebrow}>PRESENTATION</div><h3>{item.label}</h3><p className={styles.cardNote}>{item.note}</p><span className={styles.cardTag}>{item.tag}</span></article>)}</div></>;

  if(stage==="companion")return <><section className={styles.hero}><span className={styles.stageIndex}>COMPANION SCENE</span><div><div className={styles.eyebrow}>COMPANION</div><h1>Một người bạn nhớ những khoảnh khắc đẹp.</h1><p>Companion state chỉ được render từ projection/fixture; Lab không persistence mood, memory hay progression.</p></div></section><section className={styles.companion}><div className={styles.companionOrb}>M</div><div><div className={styles.eyebrow}>{scene.companion.mood}</div><h2>{scene.companion.name}</h2><p>{scene.companion.message}</p><span className={styles.cardTag}>{scene.companion.tag}</span></div></section></>;

  if(stage==="ritual")return <><section className={styles.hero}><span className={styles.stageIndex}>RITUAL SCENE</span><div><div className={styles.eyebrow}>RITUAL</div><h1>{scene.ritual.title}</h1><p>{scene.ritual.prompt}</p></div></section><section className={styles.ritual}><div className={styles.eyebrow}>REVEAL</div><h2>✦</h2><p>{scene.ritual.reveal}</p><div className={styles.reveal}>Presentation reveal · {scene.ritual.tag} · không consume inventory hoặc currency.</div></section></>;

  return <><section className={styles.hero}><span className={styles.stageIndex}>AMBIENT HOUSE</span><div><div className={styles.eyebrow}>HOUSE AFTER SESSION</div><h1>{scene.ambientHouse.headline}</h1><p>Ambient House là experience presentation; nó không sở hữu canonical world-state truth.</p></div></section><section className={styles.ambient}><div><div className={styles.eyebrow}>{scene.ambientHouse.weather}</div><h2>PINO House</h2><p>{scene.ambientHouse.presenceNote}</p><span className={styles.cardTag}>{scene.ambientHouse.tag}</span></div></section></>;
}
