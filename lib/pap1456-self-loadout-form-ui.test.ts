// PAP-1456 / Epic PAP-1097 — PINO DS form grammar for Self Loadout.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";
import { runInNewContext } from "node:vm";
const editor = readFileSync(new URL("../app/bo/pinoria-avatars/SelfLoadoutDetail.tsx", import.meta.url), "utf8");
const preview = readFileSync(new URL("../app/components/pinoria/SelfLoadoutPreview.tsx", import.meta.url), "utf8");

test("PAP-1456 8-slot editor uses existing PINO DS labels, controls and actions", () => {
  assert.match(editor, /className="pds-property-row"/);
  assert.match(editor, /className="pds-property-label"/);
  assert.match(editor, /className="pds-property-input"/);
  assert.match(editor, /className="pds-property-actions"/);
  assert.match(editor, /className="pds-property-save"/);
  assert.doesNotMatch(editor, /className="property-control"|className="toolbar"|<form className="grid-card"/);
  assert.match(editor, /id="self-loadout-reason" required maxLength=/);
  assert.match(editor, /loadout\.ready\?"Sẵn sàng"/);
  assert.match(editor, /SLOTS\.map|options\.map/);
  assert.match(editor, /canViewItems/);
  assert.match(editor, /onSubmit=\{e=>\{void submit\(e\);\}\}/);
});

test("PAP-1456 preserves approved 9:16 Core-only preview and DS responsive grid", () => {
  assert.match(preview, /const WIDTH=270, HEIGHT=480/);
  assert.match(preview, /className="pds-properties"/);
  assert.match(preview, /className="pds-property-grid"/);
  assert.match(preview, /width=\{WIDTH\} height=\{HEIGHT\}/);
  assert.match(preview, /className="pds-property-text"/);
  assert.match(editor, /<section aria-label="Pinoria Self Loadout">/);
  assert.doesNotMatch(preview, /localStorage|sessionStorage|mockItem|fabricated/i);
  assert.match(preview, /<figure className="pds-property-section"/);
  assert.match(editor, /<h3 className="pds-property-heading">Trang bị Self<\/h3>/);
  assert.ok(editor.indexOf('id="self-loadout-set"') < editor.indexOf('options.map'));
});

// Execute the actual handler bodies with controlled IO, without requiring React or a browser.
function handler(name: string) {
  const ast=ts.createSourceFile("SelfLoadoutDetail.tsx",editor,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
  let source="";
  function visit(node: ts.Node) {
    if(ts.isFunctionDeclaration(node) && node.name?.text===name)source=node.getText(ast);
    ts.forEachChild(node,visit);
  }
  visit(ast);
  assert.ok(source, name);
  return ts.transpile(source,{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None});
}
const selfId="01a18140-10b8-70d3-ad6b-3e747a0cddea";
function environment(fetch: (...args: unknown[])=>unknown) {
  const chosen={HAIR:"draft-item"};
  const loadout={version:4,slots:{HAIR:"saved-item"}};
  const state:Record<string,unknown>={chosen,loadout,reason:"Keep this reason",refresh:0,conflict:false};
  const context:Record<string,unknown>={fetch,selfId,loadout,chosen,centerId:"center",reason:state.reason,canEdit:true,validSelection:true,dirty:true,crypto:{randomUUID:()=>"request-key"},TypeError,Error,
    parseLoadout:(raw:{data:unknown})=>raw.data,slotIds:(value:{slots:unknown})=>value.slots,onSaved:()=>{state.saved=true;}};
  for(const field of ["Chosen","Loadout","Reason","Refresh","Conflict","Error","Notice","Saving"]){
    const key=field[0].toLowerCase()+field.slice(1);
    context["set"+field]=(value:unknown)=>{state[key]=typeof value==="function"?value(state[key]):value;};
  }
  return {state,context,chosen,loadout};
}

for(const failure of ["network",403,409,500] as const)test(`PAP-1456 ${failure} save failure preserves choices, reason and snapshot`,async()=>{
  const env=environment(async()=>{
    if(failure==="network")throw new TypeError("Failed to fetch");
    return {ok:false,status:failure};
  });
  await runInNewContext(handler("submit")+"\nsubmit({preventDefault(){}})",env.context);
  assert.equal(env.state.chosen,env.chosen);
  assert.equal(env.state.loadout,env.loadout);
  assert.equal(env.state.reason,"Keep this reason");
  assert.equal(env.state.refresh,0,"failure must never trigger a draft-replacing GET");
  assert.equal(env.state.saving,false);
  assert.equal(env.state.conflict,failure===409);
  assert.match(String(env.state.error),/giữ lại/);
});

test("PAP-1456 success sends CAS, reason and idempotency; adopts server snapshot",async()=>{
  const snapshot={version:5,slots:{HAIR:"saved-item"}};
  let request:Record<string,unknown>={};
  const env=environment(async(_url,init)=>{request=init as Record<string,unknown>;return {ok:true,json:async()=>({data:snapshot})};});
  await runInNewContext(handler("submit")+"\nsubmit({preventDefault(){}})",env.context);
  assert.deepEqual(JSON.parse(String(request.body)),{expectedVersion:4,itemIdsBySlot:env.chosen,reason:"Keep this reason"});
  assert.equal((request.headers as Record<string,string>)["idempotency-key"],"request-key");
  assert.equal(env.state.loadout,snapshot);
  assert.equal(env.state.chosen,snapshot.slots);
  assert.equal(env.state.reason,"");
  assert.equal(env.state.saved,true);
});

test("PAP-1456 invalid/unavailable inventory blocks save; reset clears stale reason and notice",async()=>{
  for(const guard of ["canEdit","validSelection"]){
    const env=environment(async()=>{assert.fail("must not POST");});
    env.context[guard]=false;
    await runInNewContext(handler("submit")+"\nsubmit({preventDefault(){}})",env.context);
    assert.equal(env.state.reason,"Keep this reason");
  }
  const env=environment(async()=>{});
  env.context.conflict=false;
  env.state.notice="Old success";
  runInNewContext(handler("resetDraft")+"\nresetDraft()",env.context);
  assert.equal(env.state.chosen,env.loadout.slots);
  assert.equal(env.state.reason,"");
  assert.equal(env.state.notice,"");
  assert.equal(env.state.error,"");
});

test("PAP-1456 independent inventory read, stable saved media and explicit conflict recovery",()=>{
  assert.match(editor,/const readLoadout=load\(base\+"\/loadout"/);
  assert.match(editor,/const readItems=canViewItems\?load\(base\+"\/items"/);
  assert.match(editor,/inventoryReady=canViewItems && owned!==null/);
  assert.match(editor,/canEdit=canManage && inventoryReady && !loading && !saving && !conflict/);
  assert.match(editor,/useCallback\([\s\S]*?\[selfId,centerId\]\)/);
  assert.match(editor,/mediaSrc=\{mediaSrc\}/);
  assert.match(editor,/Bỏ bản nháp và tải lại/);
  assert.match(editor,/role="status" className="pds-property-text">\{dirty\?/);
  assert.doesNotMatch(editor,/style=\{|\.module\.css/);
});

// Run the actual component effect with decoded-image/canvas IO doubles. No tabs,
// media requests or persistent state are touched. Alpha tests are MIME-independent.
type Sprite={alpha:number;mime:string;width:number;height:number;fail?:boolean;unreadable?:boolean};
async function composite(sprites:Record<string,Sprite>,renderStack:string[],foreign=false){
  const draws:{src:string;alpha:number;geometry:number[]}[]=[];
  const samples:string[]=[];
  const state:unknown[]=[];
  let effect:()=>void=()=>{};
  let finish:()=>void=()=>{};
  const done=new Promise<void>(resolve=>{finish=resolve;});
  const ctx={globalAlpha:1,clearRect(){},save(){},restore(){this.globalAlpha=1;},translate(){},rotate(){},scale(){},
    drawImage(img:{src:string},...geometry:number[]){draws.push({src:img.src,alpha:this.globalAlpha,geometry});}};
  class DecodedImage {
    onload:(()=>void)|null=null;
    onerror:(()=>void)|null=null;
    value="";
    get src(){return this.value;}
    set src(value:string){this.value=value;if(value)queueMicrotask(()=>{
      if(sprites[value]?.fail)this.onerror?.();else this.onload?.();
    });}
  }
  const exports:Record<string,(props:unknown)=>unknown>={};
  let stateIndex=0;
  runInNewContext(ts.transpile(preview,{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}),{
    exports,Image:DecodedImage,AbortController,URL,window:{location:{href:"https://bo.example/bo",origin:"https://bo.example"}},
    OffscreenCanvas:class{
      width:number;height:number;
      constructor(width:number,height:number){this.width=width;this.height=height;}
      getContext(){
        const sample=this;
        let sprite:Sprite;
        return {drawImage(img:{src:string},...geometry:number[]){
          samples.push(img.src);sprite=sprites[img.src];
          assert.deepEqual(geometry,[0,0,8,8]);
          assert.equal(sample.width,8);assert.equal(sample.height,8);
        },getImageData(){
          if(sprite.unreadable)throw Error("SecurityError");
          const data=new Uint8ClampedArray(8*8*4).fill(255);
          data[3]=sprite.alpha;
          return {data};
        }};
      }
    },
    document:{createElement(tag:string){
      assert.equal(tag,"canvas");
      const sample={width:0,height:0,getContext(){
        let sprite:Sprite;
        return {drawImage(img:{src:string},...geometry:number[]){
          samples.push(img.src);sprite=sprites[img.src];
          assert.deepEqual(geometry,[0,0,8,8]);
          assert.equal(sample.width,8);assert.equal(sample.height,8);
        },getImageData(){
          if(sprite.unreadable)throw Error("SecurityError");
          const data=new Uint8ClampedArray(8*8*4).fill(255);
          data[data.length-1]=sprite.alpha;
          return {data};
        }};
      }};
      return sample;
    }},
    require(name:string){
      if(name==="react")return {
        useRef:()=>({current:{getContext:()=>ctx}}),
        useEffect:(callback:()=>void)=>{effect=callback;},
        useState:(initial:unknown)=>{const index=stateIndex++;return [initial,(value:unknown)=>{state[index]=value;if(index===1)finish();}];},
      };
      if(name==="react/jsx-runtime")return {jsx:()=>null,jsxs:()=>null};
      throw Error(name);
    },
  });
  const slots=Object.fromEntries(Object.keys(sprites).map(slot=>[slot,{itemId:slot,displayName:slot,positionX:0,positionY:0,scale:1,rotationDegrees:null}]));
  exports.SelfLoadoutPreview({loadout:{version:4,slots,renderStack},mediaSrc:(slot:string)=>foreign?"https://foreign.example/"+slot:slot});
  effect();
  await done;
  return {draws,samples,missing:JSON.parse(JSON.stringify(state[0])),warnings:JSON.parse(JSON.stringify(state[1]))};
}
const opaqueQa:Sprite={alpha:255,mime:"image/png",width:120,height:120};
const transparentWebp:Sprite={alpha:0,mime:"image/webp",width:96,height:128};

test("PAP-1456 opaque QA HAIR/FACE/OUTFIT cannot cover Boy; transparent WebP still composites",async()=>{
  const result=await composite({HAIR:opaqueQa,FACE:opaqueQa,OUTFIT:opaqueQa,HEADWEAR:transparentWebp},["CHAR_BASE","OUTFIT","HAIR","FACE","HEADWEAR"]);
  assert.deepEqual(result.draws.map(d=>d.src),["https://assets.pinohouse.art/pinoria/char-base.png","HEADWEAR"]);
  assert.equal(result.draws[0].alpha,.35);
  assert.deepEqual(result.draws[0].geometry,[0,0,270,480]);
  assert.equal(result.draws[1].alpha,1);
  assert.deepEqual(result.draws[1].geometry,[-135,-240,270,480]);
  assert.deepEqual(result.warnings,{opaque:["OUTFIT","HAIR","FACE"],unchecked:[]});
  assert.deepEqual(result.missing,[]);
});

test("PAP-1456 PNG/WebP alpha sprites pass; Core order, pre-base and aura media are preserved",async()=>{
  for(const mime of ["image/png","image/webp"]){
    const result=await composite({BACK:opaqueQa,AURA_BACK:opaqueQa,AURA_GROUND:opaqueQa,HAIR:{...opaqueQa,mime,alpha:254},PATH_MARK:{...transparentWebp,mime}},["AURA_GROUND","BACK","CHAR_BASE","AURA_BACK","HAIR","PATH_MARK"]);
    assert.deepEqual(result.draws.map(d=>d.src),["AURA_GROUND","BACK","https://assets.pinohouse.art/pinoria/char-base.png","AURA_BACK","HAIR","PATH_MARK"]);
    assert.deepEqual(result.samples,["HAIR","PATH_MARK"]);
    assert.deepEqual(result.warnings,{opaque:[],unchecked:[]});
  }
});

test("PAP-1456 unavailable network, unreadable alpha and opaque media have distinct outcomes; URL guard retained",async()=>{
  const result=await composite({HAIR:{...opaqueQa,fail:true},FACE:{...opaqueQa,unreadable:true},OUTFIT:opaqueQa},["CHAR_BASE","HAIR","FACE","OUTFIT"]);
  assert.deepEqual(result.missing,["HAIR"]);
  assert.deepEqual(result.warnings,{opaque:["OUTFIT"],unchecked:["FACE"]});
  const blocked=await composite({HAIR:transparentWebp},["CHAR_BASE","HAIR"],true);
  assert.deepEqual(blocked.missing,["HAIR"]);
  assert.deepEqual(blocked.samples,[]);
  assert.equal(blocked.draws.length,1);
  assert.match(preview,/<p role="alert">Item media không phù hợp[^<]*opaque/);
  assert.match(preview,/mediaWarnings\.opaque\.join\(", "\)/);
  assert.match(preview,/<p role="alert">Không kiểm tra được độ trong suốt/);
  assert.doesNotMatch(preview,/style=\{|\.module\.css|crossOrigin|\.assetKey/);
});
