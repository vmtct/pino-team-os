/** PAP-1710 / Epic PAP-1705 · Create Avatar local scope contract tests. */
import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {
 candidateHasAvatar,isEligibleAvatarCandidate,matchingAvatarCandidates
} from "../app/bo/pinoria-avatars/avatar-picker";
const clean={personId:"01a1ba87-86df-77bd-be66-b544f02c53c7",displayName:"Lê Thảo My",
 avatarStatus:"SELF_MISSING",subjectStatus:"ACTIVE",subjectTypes:["LEARNER"]};
const taken={...clean,personId:"01a0b299-9e9e-7777-8a88-1234567890ab",displayName:"Phạm Gia Bảo",avatarStatus:"ACTIVE",
 pinoriaSelfId:"01a1ba89-a1d0-779c-bcb1-205edca252d8"};
const dual={...clean,personId:"019b1157-0001-7000-8000-000000000001",displayName:"Trần Khánh",
 subjectStatus:"MIXED",subjectTypes:["LEARNER","STAFF"]};
test("PAP-1710 Center-scoped Person response shape has strict eligibility",()=>{
 assert.equal(isEligibleAvatarCandidate(clean),true);
 assert.equal(isEligibleAvatarCandidate(dual),true);
 assert.equal(isEligibleAvatarCandidate({...clean,personId:"invalid-person"}),false);
 assert.equal(isEligibleAvatarCandidate({...clean,displayName:""}),false);
 assert.equal(isEligibleAvatarCandidate({...clean,subjectStatus:"ARCHIVED"}),false);
 assert.equal(isEligibleAvatarCandidate({...clean,subjectTypes:[25]}),false);
});
test("PAP-1710 already-has-Avatar cannot be mistaken for eligible create",()=>{
 assert.equal(candidateHasAvatar(clean),false);
 assert.equal(candidateHasAvatar(taken),true);
 assert.equal(candidateHasAvatar({...clean,avatarStatus:"READY"}),true);
 assert.equal(candidateHasAvatar({...clean,pinoriaSelfId:null}),false);
});
test("PAP-1710 search filters person names and role without changing actual identity",()=>{
 const source=[clean,taken,dual];
 assert.deepEqual(matchingAvatarCandidates(source,""),source);
 assert.deepEqual(matchingAvatarCandidates(source,"PHẠM").map(x=>x.personId),[taken.personId]);
 assert.deepEqual(matchingAvatarCandidates(source,"Staff").map(x=>x.personId),[dual.personId]);
 assert.deepEqual(matchingAvatarCandidates(source,"không tồn tại"),[]);
});
test("PAP-1710 canonical Dsa Drawer with one combobox and correct preserved Core POST",()=>{
 const c=readFileSync(new URL("../app/bo/pinoria-avatars/CreateSelfDrawer.tsx",import.meta.url),"utf8");
 const host=readFileSync(new URL("../app/bo/pinoria-avatars/AvatarDirectoryDsa.tsx",import.meta.url),"utf8");
 assert.match(c,/import \{ DrawerFrame \} from "@\/app\/components\/workspace-renderer\/DrawerFrame"/);
 assert.match(c,/<DrawerFrame title="Tạo Avatar" path="Pinoria · Avatar"/);
 assert.match(c,/role="combobox"/);
 assert.match(c,/role="listbox"/);
 assert.match(c,/aria-activedescendant/);
 assert.match(c,/if\(e\.key==="Enter"&&open\)/);
 assert.match(c,/document\.activeElement!==inputRef\.current/);
 assert.match(c,/method:"POST"/);
 assert.match(c,/const payload=\{personId:chosen\.personId/);
 assert.match(c,/\.\.\.\(choice\?\{starter:\{setItemId:choice\.setItemId,expectedMembershipRevision:choice\.membershipRevision\}\}:\{\}\)/);
 assert.match(c,/body:JSON\.stringify\(payload\)/);
 assert.match(c,/r\.status===409|response\.status===409/);
 assert.match(c,/response\.status!==201/);
 assert.match(c,/credentials:"same-origin"/);
 assert.match(c,/new URLSearchParams\(\{centerId/);
 assert.match(c,/page<10/);
 assert.match(c,/ctl\.abort\(\)/);
 // PAP-1743: shared typed disclosure, no bespoke duplicate wrapper.
 assert.match(c,/<PropertySections variant="drawer" fields=\{auditFields\} record=\{draft\} sections=\{avatarSections\}\/>/);
 assert.doesNotMatch(c,/<details className="property-section pino-avatar-audit">/);
 assert.doesNotMatch(c,/id="ps-create-search"/);
 assert.doesNotMatch(c,/>Tìm Person<\/label>/);
 assert.match(host,/grants\.has\("pinoria.self.create"\)/);
 assert.match(host,/＋ Tạo Avatar/);
 assert.match(host,/Đã tạo Avatar\./);
 assert.doesNotMatch(host,/＋ Tạo Self/);
});
