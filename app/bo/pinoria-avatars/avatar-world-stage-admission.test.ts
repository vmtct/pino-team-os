import test from "node:test";
import assert from "node:assert/strict";
import {admitAvatarWorldStage,requestedAvatarWorldFixture} from "./avatar-world-stage-admission";
import {avatarWorldReviewMarker} from "./avatar-world-m1-fixture";
import {WORLD_PERMISSIONS} from "./SelfWorldNative";
import type {BoShellContext} from "@/lib/bo-shell-gate";
const center="01a194f0-9bd0-7896-89a0-000000000099";
const actor:BoShellContext={userId:"qa-actor",email:"qa@example.invalid",staffMemberId:null,displayName:null,surface:"BO",entitled:true,permissionKeys:["team.bo.access"]};
const authority={centerId:center,principalId:actor.userId,grants:new Set<string>(WORLD_PERMISSIONS.slice(0,3))};
const valid={environment:"staging",hostname:"bo.staging.pinohouse.art",enabled:"1",query:{record:avatarWorldReviewMarker,centerId:center},actor,selectedCenterId:center,authority};
test("PAP-2153 exact explicit synthetic route, never generic query opt-in",()=>{
 assert.equal(requestedAvatarWorldFixture(valid.query),true);
 for(const query of [{},{record:[avatarWorldReviewMarker]},{record:"other"},{record:avatarWorldReviewMarker,preview:"1"},{record:avatarWorldReviewMarker,centerId:"bad"}])assert.equal(requestedAvatarWorldFixture(query),false);
});
test("PAP-2153 staging admission requires actual actor, exact Center and World view permission",()=>{
 assert.equal(admitAvatarWorldStage(valid),true);
 for(const patch of [{environment:"production"},{hostname:"ho.staging.pinohouse.art"},{enabled:"0"},{actor:null},{actor:{...actor,permissionKeys:[]}},{authority:null},{authority:{...authority,principalId:"other"}},{selectedCenterId:"other"},{authority:{...authority,centerId:"other"}},{query:{...valid.query,centerId:"01a194f0-9bd0-7896-89a0-000000000098"}}])assert.equal(admitAvatarWorldStage({...valid,...patch}),false);
 for(const missing of WORLD_PERMISSIONS.slice(0,3))assert.equal(admitAvatarWorldStage({...valid,authority:{...authority,grants:new Set([...authority.grants].filter(k=>k!==missing))}}),false);
});
