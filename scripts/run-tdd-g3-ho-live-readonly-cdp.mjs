// PAP-1073 local-only real DOM geometry audit against the Founder-approved fixture baseline.
// Direct Chromium CDP is used only when Playwright browser-attach is unavailable.
// No session export, trace/screenshot, credentials, PII output, or data mutation.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
const host="http://127.0.0.1:9337";
const url="https://ho.staging.pinohouse.art/ho/staff";
const widths=[1440,1024,768,390,320];
const stages=["table","drawer","detail"];
if(process.env.CI || process.env.G3_LIVE_CDP_APPROVED!=="1") throw Error("Local CDP requires approval and may not run in CI");
const goldenRoot=resolve("docs/visual-goldens/pap1073/run-40811677302");
const targetResponse=await fetch(host+"/json/new?"+encodeURIComponent("about:blank"),{method:"PUT",signal:AbortSignal.timeout(12000)});
if(!targetResponse.ok)throw Error("CDP_TARGET_CREATE_"+targetResponse.status);
const target=await targetResponse.json();
const ws=new WebSocket(target.webSocketDebuggerUrl);
let id=0;const requests=new Map();const rows=[];
ws.onmessage=e=>{const m=JSON.parse(e.data);if(!m.id||!requests.has(m.id))return;const req=requests.get(m.id);requests.delete(m.id);clearTimeout(req.timer);m.error?req.reject(Error("CDP_COMMAND_FAILED_"+m.error.code)):req.resolve(m.result)};
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
function evaluateMetric(stage){
  const root=document.querySelector('[data-tdd-shell="'+stage+'"]');
  const visible=node=>!!node&&getComputedStyle(node).display!=="none"&&node.getBoundingClientRect().height>0;
  const dim=selector=>document.querySelector(selector)?.getBoundingClientRect().width??null;
  const controls=[...document.querySelectorAll('[data-tdd-properties="drawer"] .property-control')].filter(visible);
  const list=document.querySelector('[data-tdd-shell="detail"] [role="tablist"]');
  const tabs=[...document.querySelectorAll('[data-tdd-shell="detail"] [role="tab"]')].filter(visible);
  const selected=tabs.filter(node=>node.getAttribute("aria-selected")==="true");
  const selectedControls=selected[0]?.getAttribute("aria-controls");
  return {
    path:location.pathname,
    viewport:innerWidth,
    hasRoot:visible(root),
    documentOverflow:Math.max(0,document.documentElement.scrollWidth-innerWidth),
    shellWidth:root?.getBoundingClientRect().width??0,
    quickViews:document.querySelectorAll('button[aria-label^="Quick View"]').length,
    rowHeight:document.querySelector("#typed-table tbody tr")?.getBoundingClientRect().height??
      document.querySelector('tbody tr')?.getBoundingClientRect().height??null,
    drawerWidth:dim('[data-tdd-shell="drawer"]'),
    propertyColumns:controls.length,
    minPropertyValueWidth:controls.length?Math.min(...controls.map(n=>n.getBoundingClientRect().width)):null,
    heroWidth:dim('.detail-hero'),
    tablistWidth:list?.getBoundingClientRect().width??null,
    visibleTabs:tabs.length,
    mountedPanel:!!document.querySelector('[data-tdd-shell="detail"] [role="tabpanel"]'),
    ariaLinked:selected.length===1&&!!selectedControls&&!!document.getElementById(selectedControls),
    searchVisible:visible(document.querySelector('#search'))||
      visible(document.querySelector('main input[type="search"]'))
  };
}
function evaluateClick(stage){
  if(stage==="drawer"){
    const button=document.querySelector('[data-tdd-shell="table"] tbody tr button[aria-label^="Quick View"]');
    if(!button)return false;button.click();return true;
  }
  if(stage==="detail"){
    const buttons=[...document.querySelectorAll('[data-tdd-shell="drawer"] button')];
    const button=buttons.find(node=>(node.getAttribute("aria-label")||"").includes("Full Detail")||
      (node.textContent||"").includes("Full Detail"));
    if(!button)return false;button.click();return true;
  }
  return false;
}
function faults(m,stage){
  const errors=[];
  if(!m.hasRoot||m.shellWidth<100||m.shellWidth>m.viewport+1)errors.push("SHELL_MISSING_OR_INVALID");
  if(m.documentOverflow>2)errors.push("DOCUMENT_OVERFLOW");
  if(stage==="table"){
    if(!m.rowHeight||m.rowHeight<28||m.rowHeight>130)errors.push("ROW_HEIGHT");
    if(!m.searchVisible)errors.push("SEARCH_HIDDEN");
  }
  if(stage==="drawer"){
    if(!m.drawerWidth||m.drawerWidth>m.viewport+1)errors.push("DRAWER_VIEWPORT");
    if(m.propertyColumns<3)errors.push("DRAWER_PROPERTIES");
    if((m.minPropertyValueWidth??0)<105)errors.push("DRAWER_VALUE_TOO_NARROW");
  }
  if(stage==="detail"){
    if(!m.heroWidth||m.heroWidth>m.viewport+1)errors.push("DETAIL_HERO");
    if(m.visibleTabs<2||!m.mountedPanel)errors.push("DETAIL_TABS");
    if(!m.ariaLinked)errors.push("DETAIL_ARIA");
    if((m.tablistWidth??0)>m.viewport+1)errors.push("DETAIL_TABLIST_CLIPPED");
  }
  return errors;
}
try{
  await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error("CDP_WS_TIMEOUT")),12000);ws.onopen=()=>{clearTimeout(timer);resolve()};ws.onerror=()=>reject(Error("CDP_WS_ERROR"))});
  const call=(method,params={})=>new Promise((resolve,reject)=>{
    const seq=++id;
    const timer=setTimeout(()=>{requests.delete(seq);reject(Error("CDP_TIMEOUT_"+method))},18000);
    requests.set(seq,{resolve,reject,timer});
    ws.send(JSON.stringify({id:seq,method,params}));
  });
  const evalfn=async(fn,arg)=>{
    const r=await call("Runtime.evaluate",{expression:"("+fn.toString()+")("+JSON.stringify(arg)+")",returnByValue:true});
    if(r.exceptionDetails)throw Error("PAGE_EVALUATION_EXCEPTION");
    return r.result?.value;
  };
  async function untilStage(stage,timeout=24000){
    const started=Date.now();let val;
    while(Date.now()-started<timeout){
      try{
        val=await evalfn(evaluateMetric,stage);
        if(val?.path==="/ho/staff"&&val?.hasRoot&&(stage==="table"?(val.quickViews>0&&val.rowHeight>=28&&val.rowHeight<=130):stage==="drawer"?val.propertyColumns>=3:(val.visibleTabs>=2&&val.mountedPanel)))return val;
      }catch{}
      await wait(850);
    }
    throw Error("MISSING_"+stage.toUpperCase());
  }
  await call("Page.enable");await call("Runtime.enable");
  for(const width of widths){
    await call("Emulation.setDeviceMetricsOverride",{width,height:900,deviceScaleFactor:1,mobile:false});
    await call("Page.navigate",{url});
    for(const stage of stages){
      try{
        if(stage!=="table"){
          const triggered=await evalfn(evaluateClick,stage);
          if(!triggered)throw Error("BUTTON_MISSING");
        }
        const m=await untilStage(stage,18000);
        if(stage==="drawer")await wait(1000);
        const gold=JSON.parse(readFileSync(resolve(goldenRoot,"ho",String(width),"geometry.json"),"utf8")).stages[stage];
        const delta={};
        for(const key of ["rowHeight","drawerWidth","minPropertyValueWidth","heroWidth","tablistWidth"]){
          if(typeof m[key]==="number"&&typeof gold[key]==="number")delta[key]=Math.round((m[key]-gold[key])*10)/10;
        }
        const errors=faults(m,stage);
        rows.push({surface:"HO Staff",width,stage,status:errors.length?"FAIL":"PASS",issues:errors,
          metrics:{documentOverflow:m.documentOverflow,shellWidth:m.shellWidth,rowHeight:m.rowHeight,drawerWidth:m.drawerWidth,
            propertyColumns:m.propertyColumns,minPropertyValueWidth:m.minPropertyValueWidth,heroWidth:m.heroWidth,
            tablistWidth:m.tablistWidth,visibleTabs:m.visibleTabs,mountedPanel:m.mountedPanel,ariaLinked:m.ariaLinked},
          deltasFromApprovedFixture:delta});
      }catch(e){
        rows.push({surface:"HO Staff",width,stage,status:"FAIL",issues:[String(e.message).slice(0,80)]});
      }
    }
  }
}finally{
  ws.close();
  await fetch(host+"/json/close/"+target.id,{signal:AbortSignal.timeout(10000)}).catch(()=>null);
}
const pass=rows.filter(r=>r.status==="PASS").length;
const fail=rows.length-pass;
console.log(JSON.stringify({name:"PAP-1073 live HO Staff DOM geometry",unverifiedServingSha:process.env.G3_LIVE_SERVING_SHA??"unknown",versionAttested:false,
  approvedRun:40811677302,expected:15,pass,fail,results:rows},null,2));
if(fail||pass!==15)process.exitCode=1;
