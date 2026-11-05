import assert from "node:assert/strict";
import test from "node:test";
import { emptyBoInlineEditState, stageBoInlineEdit, undoBoInlineEdit } from "./bo-inline-edit-state";
const fields = new Set(["name"]);
test("reject unapproved field and no-op", () => {
  assert.equal(stageBoInlineEdit(emptyBoInlineEditState, {rowKey:"1",field:"salary",before:2,after:3},fields), emptyBoInlineEditState);
  assert.equal(stageBoInlineEdit(emptyBoInlineEditState, {rowKey:"1",field:"name",before:"A",after:"A"},fields), emptyBoInlineEditState);
});
test("stage and undo local draft without invoking persistence", () => {
  const one = stageBoInlineEdit(emptyBoInlineEditState,{rowKey:"1",field:"name",before:"A",after:"B"},fields);
  assert.deepEqual(one.pending,[{rowKey:"1",field:"name",before:"A",after:"B"}]);
  const two = stageBoInlineEdit(one,{rowKey:"1",field:"name",before:"B",after:"C"},fields);
  assert.deepEqual(two.pending,[{rowKey:"1",field:"name",before:"A",after:"C"}]);
  const undo = undoBoInlineEdit(two);
  assert.deepEqual(undo.pending,[{rowKey:"1",field:"name",before:"A",after:"B"}]);
  assert.deepEqual(undoBoInlineEdit(undo).pending,[]);
});
test("undo restores draft after staged value is reverted to original", () => {
 const first=stageBoInlineEdit(emptyBoInlineEditState,{rowKey:"1",field:"name",before:"A",after:"B"},fields);
 const reverted=stageBoInlineEdit(first,{rowKey:"1",field:"name",before:"B",after:"A"},fields);
 assert.deepEqual(reverted.pending,[]);
 assert.deepEqual(undoBoInlineEdit(reverted).pending,[{rowKey:"1",field:"name",before:"A",after:"B"}]);
});

test("interleaved edits undo only their own cell", () => {
 const allowed=new Set(["name","status"]);
 const first=stageBoInlineEdit(emptyBoInlineEditState,{rowKey:"1",field:"name",before:"A",after:"B"},allowed);
 const second=stageBoInlineEdit(first,{rowKey:"2",field:"status",before:"Open",after:"Closed"},allowed);
 const third=stageBoInlineEdit(second,{rowKey:"1",field:"name",before:"B",after:"C"},allowed);
 const undone=undoBoInlineEdit(third);
 assert.deepEqual(undone.pending,[{rowKey:"2",field:"status",before:"Open",after:"Closed"},{rowKey:"1",field:"name",before:"A",after:"B"}]);
 assert.deepEqual(undoBoInlineEdit(undone).pending,[{rowKey:"1",field:"name",before:"A",after:"B"}]);
});

test("multiple interleaved undos restore original baseline", () => {
 const allowed=new Set(["name","status"]);
 const edits=[{rowKey:"1",field:"name",before:"A",after:"B"},{rowKey:"2",field:"status",before:"Open",after:"Closed"},{rowKey:"1",field:"name",before:"B",after:"C"}];
 const staged=edits.reduce((state,edit)=>stageBoInlineEdit(state,edit,allowed),emptyBoInlineEditState);
 const once=undoBoInlineEdit(staged);
 const twice=undoBoInlineEdit(once);
 const thrice=undoBoInlineEdit(twice);
 assert.deepEqual(twice.pending,[{rowKey:"1",field:"name",before:"A",after:"B"}]);
 assert.deepEqual(thrice.pending,[]);
 assert.deepEqual(thrice.undo,[]);
});
