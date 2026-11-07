import React,{useEffect,useState} from "react";
import {createRoot} from "react-dom/client";
import {BoRegistrationWorkspace,type BoWorkspaceSource} from "../app/bo/components/registration/BoRegistrationWorkspace";
import type {BoRecord,BoField} from "../lib/bo-registration";
import school from "../public/bo-authority-source/school-adapters.js";
const names=["Học viên A01","Học viên B02","Học viên C03","Học viên D04","Học viên E05","Học viên F06","Học viên G07","Học viên H08","Học viên I09","Học viên J10","Học viên K11","Học viên L12"];
const uuid=(n:number)=>"10000000-0000-4000-8000-"+String(n).padStart(12,"0");
function val(f:BoField,i:number,key:string,name:string):BoRecord[string]{
 if(f.key==="name")return name;
 if(f.type==="id")return uuid(100+i+key.length*10);
 if(f.type==="number")return f.key==="birthYear"?2011+i%10:f.key==="capacity"?10+i%4:i+1;
 if(f.type==="currency")return 1300000+i*50000;
 if(f.type==="formula")return i+1;
 if(f.type==="boolean")return i%3!==0;
 if(f.type==="date")return "2026-10-"+String(1+i%26).padStart(2,"0");
 if(f.type==="datetime")return "2026-10-"+String(1+i%26).padStart(2,"0")+"T08:30:00Z";
 if(f.type==="email")return "fixture"+i+"@example.invalid";
 if(f.type==="url")return "https://example.invalid/demo";
 if(f.type==="multirelation"||f.type==="multiselect")return ["ACA Art","ACA Piano"].slice(0,1+i%2);
 if(f.type==="select")return f.options?.[i%f.options.length]||["Active","Pending","Completed"][i%3];
 if(["paths","path"].includes(f.key))return ["ACA Art","ACA Piano","CAMP"][i%3];
 if(f.key==="center")return i%2?"PINO House":"PINO Station 01";
 if(f.key==="window"||f.key==="entry")return ["18:00 – 19:30","19:30 – 21:00"][i%2];
 if(f.key==="status")return ["Active","Pending","Completed"][i%3];
 return ["PINO House","Đang hoạt động","ACA Art","Level 1"][i%4];
}
const modules=school.modules;
const fixtures:Record<string,BoRecord[]>=Object.fromEntries(Object.entries(modules).map(([key,module],k)=>{
 const data=Array.from({length:12},(_,i)=>{
  const name=key==="students"?names[i]:key==="classes"?["ACA Art · Mon 18:00","ACA Piano · Tue 18:00","ACA Art · Wed 19:30"][i%3]:module.label+" · "+String(i+1).padStart(2,"0");
  const row:BoRecord={id:uuid(10000+k*100+i),name};
  for(const f of module.fields)if(f.key!=="id")row[f.key]=val(f,i,key,name);
  return row;
 });
 return [key,data];
}));
const source:BoWorkspaceSource={modules,load:async(key)=>fixtures[key]||[],scopeLabel:()=>""};
const elements=[
 ["Navigation / Sidebar",".sidebar","BoRegistrationWorkspace.tsx"],
 ["Module header",".page-heading","BoRegistrationWorkspace.tsx"],
 ["Level-1 Data Table",".grid-card","BoDataTable.tsx"],
 ["Saved Views",".view-tabs","BoViewTabs.tsx"],
 ["Search / Filters",".toolbar","BoDataTable.tsx"],
 ["Header columns","thead","BoDataTable.tsx"],
 ["Quick View trigger",".row-open","BoDataTable.tsx"],
 ["Table footer",".table-footer","BoDataTable.tsx"],
 ["Quick View Drawer","#drawer","BoQuickView.tsx"],
 ["Drawer property row",".property-row","BoQuickView.tsx"],
 ["Full Detail","#detail-screen","BoFullDetail.tsx"],
 ["Full Detail tabs","#detail-tabs","BoFullDetail.tsx"],
 ["Table Settings",".settings-panel","BoTableSettings.tsx"]
];
function App(){
 const params=new URLSearchParams(location.search);
 const [moduleKey,setModuleKey]=useState(Object.hasOwn(modules,params.get("module")||"")?params.get("module")!:"students");
 const [open,setOpen]=useState(false),[metric,setMetric]=useState("");
 const clean=params.has("clean");
 function move(key:string){if(!Object.hasOwn(modules,key))return;setModuleKey(key);history.replaceState({},"","/?module="+key+(clean?"&clean=1":""));setMetric("");}
 function click(ev:React.MouseEvent<HTMLDivElement>){
  const link=(ev.target as Element).closest("a[href]");if(!link)return;
  const href=link.getAttribute("href")||"";if(!href.startsWith("/bo"))return;
  ev.preventDefault();move(new URL(href,location.origin).searchParams.get("module")||"students");
 }
 function inspect(selector:string){
  const node=document.querySelector<HTMLElement>(selector);
  if(!node){setMetric(selector+" · mở màn hình phù hợp trước");return;}
  const r=node.getBoundingClientRect(),s=getComputedStyle(node);
  setMetric(selector+" · x="+r.x.toFixed(1)+" y="+r.y.toFixed(1)+" w="+r.width.toFixed(1)+" h="+r.height.toFixed(1)+" CSS px; font="+s.fontSize+"; gap="+s.gap+"; padding="+s.padding);
  node.classList.add("ds-outline");node.scrollIntoView({block:"nearest",behavior:"smooth"});setTimeout(()=>node.classList.remove("ds-outline"),1800);
 }
 return <><div onClickCapture={click}><BoRegistrationWorkspace key={moduleKey} currentUser={{displayName:"DS Fixture"}} moduleKey={moduleKey} source={source}/></div>{!clean?<div className="ds-tool"><button className="ds-toggle" onClick={()=>setOpen(v=>!v)} aria-expanded={open}>◫ DS Catalog <span>Fixture</span></button>{open?<div className="ds-guide"><header><b>BO Staging · Design System</b><button aria-label="Đóng" onClick={()=>setOpen(false)}>×</button></header><p>Component React thật từ BO V2.5; dữ liệu fixture; không gọi Core/D1. Production không được dùng làm chuẩn.</p><label>Module<select value={moduleKey} onChange={e=>move(e.target.value)}>{Object.entries(modules).map(([key,m])=><option key={key} value={key}>{m.label}</option>)}</select></label><h4>Element locations / CSS geometry</h4><div className="ds-elements">{elements.map(([label,selector,file])=><button key={selector} onClick={()=>inspect(selector)}><b>{label}</b><small>{file}</small></button>)}</div>{metric?<output>{metric}</output>:null}<footer><b>Source:</b> pino-team-os @ 5848b0e (2026-10-26). Stylesheets imported unchanged from BO Authority. Runtime iconography still has Unicode glyphs; semantic Font Awesome registry not yet adopted.</footer></div>:null}</div>:null}<div className="ds-watermark">DS FIXTURE · BO STAGING AUTHORITY · NO REAL DATA</div></>;
}
createRoot(document.getElementById("catalog-root")!).render(<App/>);
