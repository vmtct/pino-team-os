// PAP-1489 / PAP-1490, Epic PAP-1097 PNR-WARD. Synthetic read-only FE fixture.
import React from "react";
import {createRoot} from "react-dom/client";
import {TddDetail} from "../../app/components/workspace-renderer/Record";
import {SelfLoadoutDetail} from "../../app/bo/pinoria-avatars/SelfLoadoutDetail";
import {SelfWardrobeDetail} from "../../app/bo/pinoria-avatars/SelfWardrobeDetail";
import {selfDefinition} from "../../app/bo/pinoria-avatars/schema";
import {TddRegistry, type ModuleRow} from "../../lib/workspace-schema";
import type {SelfFields} from "../../app/bo/pinoria-avatars/schema";
const registry=new TddRegistry();
const schema=registry.register({...selfDefinition,data:{id:"pap1489-fixture",list:async()=>({rows:[],total:0}),detail:async()=>null}});
const record={id:"fixture-self",name:"Synthetic Self",nickname:null,createdAt:null,createdBy:null,updatedAt:null,updatedBy:null,roles:"Reception",avatarStatus:"READY",subjectStatus:"ACTIVE",avatarLabel:"Ready",subjectLabel:"Active",ownedCount:1,loadoutSummary:"1/8",rowKey:"fixture",personId:"person-fixture",pinoriaSelfId:"01a18140-10b8-70d3-ad6b-3e747a0cddea",selfStatus:"ACTIVE",staffMemberId:"staff-fixture",studentProfileId:null,loadoutVersion:1,equippedCount:1};
createRoot(document.getElementById("root")!).render(<TddDetail registry={registry} schema={schema}
  context={{surface:"BO",centerId:"center-fixture",authorize:()=>true}} record={record}
  subject={{type:"pinoria-avatars",id:record.id}} onBack={()=>{}}
  renderApprovedExtension={(row,_context,activeTab)=><>
    <SelfLoadoutDetail row={row as unknown as ModuleRow<SelfFields>} centerId="center-fixture" activeTab={activeTab} canView canManage canViewItems onSaved={()=>{}}/>
    <SelfWardrobeDetail row={row as unknown as ModuleRow<SelfFields>} centerId="center-fixture" activeTab={activeTab} canView canManage onSaved={()=>{}}/>
  </>}/>);
