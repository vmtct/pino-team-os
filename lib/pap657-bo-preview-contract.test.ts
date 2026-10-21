import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const root=new URL('../app/bo/pinoria-tv-dialogue/',import.meta.url);
const page=readFileSync(new URL('page.tsx',root),'utf8');
const editor=readFileSync(new URL('DialogueEditor.tsx',root),'utf8');
const management=readFileSync(new URL('../tvs/page.tsx',root),'utf8');
test('BO TV management links to draft-only social dialogue simulator',()=>{
 assert.match(management,/href="\/bo\/pinoria-tv-dialogue"/);
 assert.match(page,/DialogueEditor/);
 assert.match(editor,/advanceSpatialDialogue/);
});
test('no unauthorised persistence, publish or fabricated runtime truth in preview UI',()=>{
 assert.match(editor,/disabled>Publish/);
 assert.doesNotMatch(editor,/fetch\s*\(|spatialTvConfigApi\.write|localStorage|sessionStorage/);
 assert.match(editor,/Bản nháp/);
});
