// PAP-1759 · Epic PAP-1705 / PNR-AVATAR-CRUD · keyboard G3 regression.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../app/bo/pinoria-avatars/CreateSelfDrawer.tsx',import.meta.url),'utf8');
test('PAP-1759 Person role=option buttons are not native Tab stops',()=>{
 assert.match(source,/type="button" role="option" tabIndex=\{-1\}/);
 assert.match(source,/aria-activedescendant=\{open&&visibleMatches\[active\]/);
 assert.match(source,/onKeyDown=\{onComboboxKeyDown\}/);
 assert.match(source,/onKeyDownCapture=\{onComboboxKeyDownCapture\}/);
 assert.match(source,/onMouseDown=\{e=>e\.preventDefault\(\)\}/);
 assert.match(source,/onClick=\{\(\)=>choose\(option\)\}/);
});
