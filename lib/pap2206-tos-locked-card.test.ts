import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const base="app/components/tos-vnext/";
const s=readFileSync(base+"MissionAssignmentTab.tsx","utf8");
const css=readFileSync(base+"mission-assignment-choice.module.css","utf8");
test("PAP-2206 locked choices compose the same card layout with the disabled modifier",()=>{
  assert.ok(s.includes('!item.available?styles.missionChoice+" "+styles.missionChoiceDisabled:'));
  assert.ok(s.includes('choiceStyles.lockedCard'));
  assert.ok(s.includes('<FontAwesomeIcon icon={faLock}/>'));
  assert.ok(!s.includes(String.fromCodePoint(0x1f512)));
  assert.ok(s.includes('<small>C\u1ea5p {item.level}</small>'));
  assert.ok(s.includes('describeTosMissionLocks'));
});
test("PAP-2206 locked appearance uses scoped DS tokens while selection stays guarded",()=>{
  assert.match(css,/\.lockedCard\.lockedCard em\s*\{[^}]*var\(--tos-weight-medium\)[^}]*var\(--tos-color-warning-text\)/);
  assert.match(css,/overflow-wrap:\s*anywhere/);
  assert.match(css,/opacity:\s*1/);
  assert.ok(s.includes('disabled={busy||!item.available}'));
  assert.ok(s.includes('onClick={()=>{if(item.available)setChosen(item.missionId)}}'));
  assert.ok(s.includes('!selectedAvailable'));
});
