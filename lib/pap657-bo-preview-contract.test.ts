import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const root=new URL('../app/bo/pinoria-tv-dialogue/',import.meta.url);
const page=readFileSync(new URL('page.tsx',root),'utf8');
const editor=readFileSync(new URL('DialogueEditor.tsx',root),'utf8');
const management=readFileSync(new URL('../tvs/page.tsx',root),'utf8');
const managementTdd=readFileSync(new URL('../tvs/TvsTdd.tsx',root),'utf8');
const tvSchema=readFileSync(new URL('../tvs/schema.ts',root),'utf8');
test('PAP-1266 BO TV management uses canonical TDD; legacy dialogue simulator remains unadmitted until PAP-911',()=>{
 assert.match(management,/TvsTdd/);
 assert.match(managementTdd,/SurfaceWorkspace/);
 assert.match(tvSchema,/label:"Không gian"/);
 // PAP-657 simulator source is retained, but do not display an unusable navigation target:
 // staging BO route admission does not currently permit /bo/pinoria-tv-dialogue.
 assert.doesNotMatch(management,/href="\/bo\/pinoria-tv-dialogue"/);
 assert.match(page,/DialogueEditor/);
 assert.match(editor,/advanceSpatialDialogue/);
});
test('BO dialogue mutation requires explicit Core authority, scope and operator action',()=>{
 assert.match(editor,/dialogueConfigApi\.head\(scope\)/);
 assert.match(editor,/dialogueConfigApi\.write\("drafts"/);
 assert.match(editor,/dialogueConfigApi\.write\("publish"/);
 assert.match(editor,/dialogueConfigApi\.write\("revert"/);
 assert.match(editor,/window\.confirm\(/);
 assert.match(editor,/scopeValid/);
 assert.doesNotMatch(editor,/localStorage|sessionStorage/);
 assert.match(editor,/Bản nháp/);
});
test('BO proxy routes all dialogue config reads and guarded mutations to Core',()=>{
 const read=readFileSync(new URL('../lib/bo-read-handler.ts',import.meta.url),'utf8');
 const write=readFileSync(new URL('../lib/bo-write-handler.ts',import.meta.url),'utf8');
 for(const action of ['head','versions','version','active'])assert.match(read,new RegExp('pinoria/tv-config/dialogue/'+action));
 for(const action of ['drafts','publish','revert'])assert.match(write,new RegExp('pinoria/tv-config/dialogue/'+action));
 assert.match(read,/TV_DIALOGUE_CONFIG_READ\.has\(path\)/);
 assert.match(write,/TV_DIALOGUE_CONFIG_POST\.has\(path\)/);
 assert.match(write,/Idempotency-Key is required/);
});
