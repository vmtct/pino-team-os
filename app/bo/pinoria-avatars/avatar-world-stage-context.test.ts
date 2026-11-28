import test from "node:test";
import assert from "node:assert/strict";
import {parseAvatarWorldStageContext} from "./avatar-world-stage-context";
const center="01a194f0-9bd0-7896-89a0-000000000099";
const data={surface:"BO",entitled:true,userId:"qa-actor",permissionKeys:["team.bo.access","pinoria.world.avatar.view"]};
test("PAP-2153 actual scoped response preserves actor and grants, rejects malformed or denied response",()=>{
 const result={status:200,body:{data},requestId:"qa"};
 assert.deepEqual(parseAvatarWorldStageContext(result,center),{principalId:"qa-actor",centerId:center,grants:new Set(data.permissionKeys)});
 for(const patch of [{status:403},{body:null},{body:{data:{...data,surface:"HO"}}},{body:{data:{...data,entitled:false}}},{body:{data:{...data,userId:""}}},{body:{data:{...data,permissionKeys:["team.bo.access",null]}}},{body:{data:{...data,permissionKeys:[]}}}])assert.equal(parseAvatarWorldStageContext({...result,...patch},center),null);
});
