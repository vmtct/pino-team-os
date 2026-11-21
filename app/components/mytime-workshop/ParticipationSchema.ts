import {TddRegistry,type AuthorizationContext,type FieldSchema,type ModuleRow,type ModuleSchema,type TableQuery} from "@/lib/workspace-schema";

const readCaps=(surface:"BO"|"HO")=>({read:surface==="BO"?"learning.mytime_workshop.bo_view":"learning.mytime_workshop.ho_view",history:surface==="BO"?"learning.mytime_workshop.bo_view":"learning.mytime_workshop.ho_view"});
const base={display:true,search:false,filter:false,sort:false,group:false,inlineEdit:false} as const;
const searchable={...base,search:true,sort:true} as const;
const filterable={...base,filter:true,sort:true,group:true} as const;

function participationBinding(surface:"BO"|"HO"){
  const permission=readCaps(surface).read;
  const fields=[
    {key:"person",label:"Person",type:"text",icon:"Aa",width:210,permission,readOnly:true,capabilities:searchable},
    {key:"workshop",label:"Workshop",type:"text",icon:"Aa",width:220,permission,readOnly:true,capabilities:searchable},
    {key:"center",label:"Chi nhánh",type:"text",icon:"▣",width:170,permission,readOnly:true,capabilities:filterable},
    {key:"status",label:"Trạng thái",type:"text",icon:"●",width:140,permission,readOnly:true,capabilities:filterable},
    {key:"group",label:"Nhóm",type:"text",icon:"Aa",width:150,permission,readOnly:true,capabilities:filterable},
    {key:"usageCount",label:"Lượt sử dụng",type:"number",icon:"#",width:130,permission,readOnly:true,capabilities:base},
    {key:"createdAt",label:"Created Time",type:"datetime",icon:"▦",width:175,permission,readOnly:true,capabilities:base},
    {key:"createdBy",label:"Created By",type:"text",icon:"Aa",width:170,permission,readOnly:true,capabilities:base},
    {key:"updatedAt",label:"Last Modified Time",type:"datetime",icon:"▦",width:185,permission,readOnly:true,capabilities:base},
    {key:"updatedBy",label:"Last Modified By",type:"text",icon:"Aa",width:185,permission,readOnly:true,capabilities:base},
  ] as const satisfies readonly FieldSchema[];
  type Keys=typeof fields[number]["key"];
  const order=fields.map(field=>field.key) as readonly Keys[];
  const sections=[
    {id:"participation",label:"Participation",fields:["person","workshop","center","status"]},
    {id:"usage",label:"Lượt sử dụng",fields:["group","usageCount"]},
    {id:"system",label:"Thông tin hệ thống",fields:["createdAt","createdBy","updatedAt","updatedBy"]},
  ] as const;
  const query:TableQuery<typeof fields>={search:"",filters:{logic:"AND",rules:[]},sort:null,group:null,order,visible:order,page:1,pageSize:15};
  const history={kind:"unavailable",reason:"Core Participation chưa được kết nối trong M1."} as const;
  const definition={
    version:1,classification:"TDD_DEFAULT",surface,key:"mytime-participations",label:"Participation",group:"Operations",fields,
    capabilities:readCaps(surface),
    data:{id:"mt-participation-unbound",list:async()=>{throw Error("Participation Core adapter not bound");},detail:async()=>{throw Error("Participation Core adapter not bound");}},
    table:{
      identity:{field:"person",pinned:"left",hideable:false,reorderable:false},
      columns:order.map(field=>({field,visible:true})),
      search:{fields:["person","workshop"],normalization:"vi-diacritic-insensitive"},
      filters:{fields:["center","status","group"],mode:"flat",logic:"AND"},
      sort:{fields:["person","workshop","center","status","group"],mode:"single",nulls:"last",tieBreak:"record-id"},
      group:{fields:["center","group"],mode:"single"},
      views:{builtIn:[],saved:{kind:"local-ui"},actions:["add","apply","rename","delete","reorder"]},
      pagination:{sizes:[8,15,30],defaultSize:15,mode:"local-ui"},
      inlineEdit:{fields:[],enabled:false},
      interaction:{settings:["properties","grouping","filters","quick-views"],quickView:"separate-opener",keyboard:"canonical",undo:"disabled"},
    },
    drawer:{density:"one-column",sections,actions:[]},
    detail:{overview:{sections},businessTabs:[],history},
  } as const satisfies ModuleSchema<typeof fields>;
  const registry=new TddRegistry();
  const schema=registry.register(definition);
  return {registry,schema,fields,query};
}

export const boParticipationBinding=participationBinding("BO");
export const hoParticipationBinding=participationBinding("HO");
export type ParticipationBinding=ReturnType<typeof participationBinding>;
export type ParticipationRow=ModuleRow<ParticipationBinding["fields"]>;
export const boParticipationSchema=boParticipationBinding.schema;
export const hoParticipationSchema=hoParticipationBinding.schema;
export const boParticipationRegistry=boParticipationBinding.registry;
export const hoParticipationRegistry=hoParticipationBinding.registry;
