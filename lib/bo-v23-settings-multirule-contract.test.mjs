import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const code=readFileSync(new URL('../app/bo/components/data-grid/BoGridFilterSettings.tsx',import.meta.url),'utf8');
test('BO Settings retains every existing filter when editing one rule',()=>{
 assert.match(code,/value\.group\.filters\.map\(\(item, at\) => at === index \? rule : item\)/);
 assert.match(code,/filters: \[\.\.\.value\.group\.filters, initialRule\(usable\[0\]\)\]/);
 assert.match(code,/value\.group\.filters\.filter\(\(_, at\) => at !== index\)/);
});
test('BO Settings exposes AND OR and typed column controls',()=>{
 assert.match(code,/combinator: event\.target\.value as "and" \| "or"/);
 assert.match(code,/<option value="or">/);
 assert.match(code,/type=\{selected\.type === "number" \? "number" : selected\.type === "date" \? "date" : "text"\}/);
 assert.match(code,/validateBoFilterSettings\(\{ \.\.\.value, visibleKeys: next \}, fields\)/);
});
