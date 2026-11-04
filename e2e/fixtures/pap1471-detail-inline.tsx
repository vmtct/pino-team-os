import { createRoot } from "react-dom/client";
import { useState } from "react";
import { TddRegistry, type AuthorizationContext, type FieldSchema, type ModuleRow } from "../../lib/workspace-schema";
import { TddRenderer } from "../../app/components/workspace-renderer/Renderer";

declare global { interface Window { __pap1471Writes?: number; } }
const surface = location.hostname.startsWith("ho.") ? "HO" : "BO";
const scenario = new URL(location.href).searchParams.get("scenario") ?? "editable";
const fields = [
 { key:"name",label:"Họ và tên",type:"text",icon:"Aa",width:225,permission:"fixture.read",readOnly:scenario==="readonly",
   capabilities:{display:true,search:true,filter:true,sort:true,group:true,inlineEdit:scenario!=="readonly"} },
 { key:"id",label:"ID",type:"id",icon:"#",width:190,permission:"fixture.read",readOnly:true,
   capabilities:{display:true,search:false,filter:false,sort:false,group:false,inlineEdit:false} },
] as const satisfies readonly FieldSchema[];
const registry = new TddRegistry();
const schema=registry.register({
 version:1, classification:"TDD_DEFAULT",key:"pap1471-fixture",label:"PAP-1471 visual field edit",group:"Tests",surface,fields,
 capabilities:{read:"fixture.read",edit:"fixture.edit"},
 data:{id:"pap1471",list:async()=>({rows:[],total:0}),detail:async()=>null},
 table:{identity:{field:"name",pinned:"left",hideable:false,reorderable:false},
 columns:fields.map(field=>({field:field.key,visible:true})),
 search:{fields:["name"],normalization:"vi-diacritic-insensitive"},
 filters:{fields:["name"],mode:"flat",logic:"AND"},
 sort:{fields:["name"],mode:"single",nulls:"last",tieBreak:"record-id"},
 group:{fields:["name"],mode:"single"},
 views:{builtIn:[],saved:{kind:"local-ui"},actions:["add","apply","rename","delete","reorder"]},
 pagination:{sizes:[8,15,30],defaultSize:8,mode:"local-ui"},
 inlineEdit:{enabled:false,fields:[]},interaction:{settings:["properties","grouping","filters","quick-views"],quickView:"separate-opener",keyboard:"canonical",undo:"local-ui-only"}},
 drawer:{density:"one-column",sections:[{id:"main",label:"Thông tin chính",fields:["name","id"]}],actions:[]},
 detail:{overview:{sections:[{id:"main",label:"Thông tin chính",fields:["name","id"]}]},history:{kind:"unavailable",reason:"Không có lịch sử"},businessTabs:[]},
 actions:[{id:"sectionRefresh",label:"Tải lại",slot:"overview.section",targetId:"main",icon:"refresh",variant:"secondary",capability:"read",handler:"sectionRefresh"}],
});
const context: AuthorizationContext=surface==="BO"
 ? {surface:"BO",centerId:"fixture-center",authorize:()=>true}
 : {surface:"HO",authorize:()=>true};
function App(){
 const [record,setRecord]=useState({id:"fixture-001",name:"Học viên mẫu"});
 const [version,setVersion]=useState("1");
 const writes=scenario==="no-writer" ? undefined : {
  version,
  adapter:{update:async (_id:string,patch:Record<string,unknown>,v:string)=>{
   window.__pap1471Writes=(window.__pap1471Writes??0)+1;
   return {status:"saved" as const,row:{...record,...patch},version:String(Number(v)+1)};
  }},
  onSaved:(row:ModuleRow<typeof fields>,nextVersion:string)=>{setRecord({id:row.id,name:String(row.name??"")});setVersion(nextVersion);}
 };
 return <TddRenderer view={{kind:"detail",props:{
   registry,schema,context,record,status:"ready",subject:{type:"fixture",id:record.id},onBack:()=>{},
   writes,actionBindings:{sectionRefresh:{run:()=>{}}}
 }}}/>;
}
window.__pap1471Writes=0;
createRoot(document.getElementById("root")!).render(<App/>);
