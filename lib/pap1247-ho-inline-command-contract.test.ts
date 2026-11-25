import test from "node:test";
import assert from "node:assert/strict";
import {matchesRoleInlineDeclaration,parseRoleInlineRequest,roleInlineSelection,ROLE_METADATA_COMMAND} from "./workspace-adapters/ho-inline-command-contract";
const field=(key:string,type:string)=>({key,type,permission:"access.role.view",readOnly:false,capabilities:{display:true,inlineEdit:true}});
const definition={surface:"HO",key:"roles",capabilities:{read:"access.role.view",edit:"access.role.edit"},
  fields:[field("name","text"),field("description","textarea")],table:{inlineEdit:{enabled:true,fields:["name"]}}};
const declaration=ROLE_METADATA_COMMAND;
test("PAP-1247 exact Role metadata declaration, never generic mutation",()=>{
 assert.equal(matchesRoleInlineDeclaration(definition,declaration,false),true);
 assert.equal(matchesRoleInlineDeclaration({...definition,table:{inlineEdit:{enabled:false,fields:[]}}},declaration,false),true);
 assert.equal(matchesRoleInlineDeclaration(definition,declaration,true),false);
 for(const changed of [{...definition,surface:"BO"},{...definition,key:"product-plans"},
   {...definition,capabilities:{...definition.capabilities,edit:"access.role.create"}},
   {...definition,fields:[...definition.fields,field("permissionKeys","text")]},
   {...definition,fields:[definition.fields[0]!,definition.fields[0]!]},
   {...definition,fields:[{...definition.fields[0]!,readOnly:true},definition.fields[1]!]},
   {...definition,table:{inlineEdit:{enabled:true,fields:["roleKey"]}}}])
   assert.equal(matchesRoleInlineDeclaration(changed,declaration,false),false);
 for(const changed of [{...declaration,command:"generic.update"},{...declaration,permission:"access.role.create"},
   {...declaration,fields:["name","status"]},{...declaration,fields:["name","name"]},
   {...declaration,url:"/api/anything"},{...declaration,handler:"arbitrary"}])
   assert.equal(matchesRoleInlineDeclaration(definition,changed,false),false);
});
const id="01a17d3f-8697-7080-bdf1-33e939758059",expectedVersion="2026-11-25T04:00:00.000Z";
const input={id,expectedVersion,patch:{name:"  Updated ",description:" "}};
test("PAP-1247 exact canonical identity, CAS version and allowed fields only",()=>{
 assert.deepEqual(parseRoleInlineRequest(input),{id,expectedVersion,patch:{name:"Updated",description:""}});
 assert.deepEqual(parseRoleInlineRequest({...input,patch:{description:"desc"}}),{id,expectedVersion,patch:{description:"desc"}});
 for(const bad of [{...input,id:"ROLE-MOCK-001"},{...input,id:"01a17d3f-8697-4080-bdf1-33e939758059"},
   {...input,expectedVersion:"2026-11-25"},{...input,expectedVersion:"invalid"},{...input,actor:"Founder"},
   {...input,patch:{}},{...input,patch:{name:" "}},{...input,patch:{name:"x".repeat(121)}},
   {...input,patch:{description:"x".repeat(501)}},{...input,patch:{description:null}},
   {...input,patch:{name:"okay",permissionKeys:[]}},{...input,patch:{roleKey:"founder"}},
   {...input,patch:{status:"active"}},{...input,patch:{assignmentCount:0}},
   {...input,patch:{id}},{...input,patch:{url:"/api/anything"}}])
   assert.equal(parseRoleInlineRequest(bad),null);
});
test("PAP-1247 Table/Drawer selection is bounded to the exact reviewed Role projection",()=>{
 const row={id,roleKey:"custom-example",roleType:"custom",status:"active",updatedAt:expectedVersion,name:"Sample",description:""};
 const selection={host:"table",surface:"HO",moduleKey:"roles",canRead:true,canEdit:true,row,version:expectedVersion,field:"name"};
 assert.deepEqual(roleInlineSelection(selection),{id,expectedVersion,field:"name"});
 assert.deepEqual(roleInlineSelection({...selection,host:"drawer",field:"description"}),{id,expectedVersion,field:"description"});
 for(const bad of [
  {...selection,field:"description"},{...selection,host:"detail"},{...selection,surface:"BO"},
  {...selection,moduleKey:"product-plans"},{...selection,canRead:false},{...selection,canEdit:false},
  {...selection,version:undefined},{...selection,version:"2026-11-25T04:00:01.000Z"},
  {...selection,field:"permissionKeys"},{...selection,handler:"arbitrary"},
  {...selection,row:{...row,roleKey:"Founder"}},{...selection,row:{...row,roleType:"system"}},
  {...selection,row:{...row,status:"archived"}},{...selection,row:{...row,id:"ROLE-MOCK-001"}},
  {...selection,row:{...row,name:" Sample "}},{...selection,row:{...row,name:null}},
 ])assert.equal(roleInlineSelection(bad),null);
});
