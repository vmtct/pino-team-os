"use client";
import {useMemo,useState} from "react";
import {parseDialogueConfig} from "@/lib/pap657-dialogue-config";
import {advanceSpatialDialogue} from "@/lib/pap657-dialogue-proximity-engine";
const actors=[{id:"a",zoneId:"art",x:20,y:20},{id:"b",zoneId:"art",x:65,y:25},{id:"c",zoneId:"music",x:40,y:20}];
/** Draft/simulation only. Do not claim backend publish authority. */
export function DialogueEditor(){
 const[durationMs,setDuration]=useState(5000),[proximityPx,setProximity]=useState(90);
 const[pool,setPool]=useState<string[][]>([["Xin chào","Chào bạn"]]);
 const[simulating,setSimulating]=useState(false);
 const config=useMemo(()=>parseDialogueConfig({revision:1,durationMs,proximityPx,maxTvBubbles:3,maxZoneBubbles:1,pool}),[durationMs,proximityPx,pool]);
 const sample=useMemo(()=>simulating&&config?advanceSpatialDialogue({published:config,now:100,actors,active:[]}):[],[config,simulating]);
 const edit=(i:number,j:number,v:string)=>setPool(previous=>previous.map((pair,k)=>k===i?pair.map((s,l)=>l===j?v:s):pair));
 return <main style={{padding:24,maxWidth:900,margin:"auto"}}><h1>Pinoria TV · Social Dialogue</h1>
 <p>Bản nháp / mô phỏng. Chưa ghi vào cấu hình publish.</p>
 <label>Thời lượng (ms) <input type="number" min={1000} max={15000} value={durationMs} onChange={e=>setDuration(Number(e.target.value))}/></label>
 <label>Khoảng cách (px) <input type="number" min={40} max={140} value={proximityPx} onChange={e=>setProximity(Number(e.target.value))}/></label>
 <h2>Kho hội thoại</h2>{pool.map((pair,i)=><div key={i}>{pair.map((s,j)=><input key={j} aria-label={`Cặp ${i+1} lời ${j+1}`} value={s} maxLength={120} onChange={e=>edit(i,j,e.target.value)}/>)}
 <button type="button" onClick={()=>setPool(current=>current.filter((_,k)=>k!==i))}>Xóa</button></div>)}
 <button type="button" disabled={pool.length>=40} onClick={()=>setPool(current=>[...current,["Xin chào","Chào bạn"]])}>Thêm hội thoại</button>
 <p role="status">{config?"Bản nháp hợp lệ":"Cấu hình không hợp lệ"}</p>
 <button type="button" disabled={!config} onClick={()=>setSimulating(s=>!s)}>{simulating?"Dừng mô phỏng":"Mô phỏng"}</button>
 <button type="button" disabled>Publish (chưa có API)</button>
 {simulating&&<section><h2>Preview</h2><p>{sample.length} hội thoại · tối đa 3 TV, 1 zone</p>{sample.map(d=><p key={d.zoneId}>{d.zoneId}: {d.lines.join(" ↔ ")}</p>)}</section>}
 </main>;
}
