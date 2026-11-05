import test from "node:test";
import assert from "node:assert/strict";
import {
 DIARY_REGISTER_TICKET_KEY,readDiaryTicket,stageDiaryTicket,clearVerifiedDiaryTicket,
 type DiaryTicketStorage,
} from "./tos-diary-register-ticket";
const keyA="9f7b2c10-6630-4ce8-a98d-644d77e84541";
const keyB="017cd30c-792a-4b56-8cf0-607451be18a1";
function fake(){
 const data=new Map<string,string>();
 const storage:DiaryTicketStorage={
  getItem(k){return data.get(k)??null},
  setItem(k,v){data.set(k,v)},
  removeItem(k){data.delete(k)},
 };
 return{data,storage};
}
test("PAP-1400 ticket retains opaque original key across reload but stores no student information",()=>{
 const f=fake();
 assert.deepEqual(readDiaryTicket(f.storage),{state:"EMPTY",key:null});
 assert.equal(stageDiaryTicket(f.storage,keyA),true);
 assert.deepEqual(readDiaryTicket(f.storage),{state:"PENDING",key:keyA});
 assert.deepEqual([...f.data.entries()],[[DIARY_REGISTER_TICKET_KEY,keyA]]);
 assert.equal(stageDiaryTicket(f.storage,keyB),false,"cannot replace unresolved Register key");
 assert.equal(clearVerifiedDiaryTicket(f.storage,keyB),false,"wrong key cannot clear");
 assert.deepEqual(readDiaryTicket(f.storage),{state:"PENDING",key:keyA});
 assert.equal(clearVerifiedDiaryTicket(f.storage,keyA),true);
 assert.deepEqual(readDiaryTicket(f.storage),{state:"EMPTY",key:null});
 assert.equal(stageDiaryTicket(f.storage,keyB),true);
});
test("PAP-1400 corrupt/blocked storage fails closed, never assumes no prior Register",()=>{
 const f=fake();
 f.storage.setItem(DIARY_REGISTER_TICKET_KEY,"garbled");
 assert.deepEqual(readDiaryTicket(f.storage),{state:"UNAVAILABLE",key:null});
 assert.equal(stageDiaryTicket(f.storage,keyA),false);
 assert.equal(clearVerifiedDiaryTicket(f.storage,keyA),false);
 assert.equal(f.data.get(DIARY_REGISTER_TICKET_KEY),"garbled");
 const blocked:DiaryTicketStorage={
  getItem(){throw Error("blocked")},
  setItem(){throw Error("blocked")},
  removeItem(){throw Error("blocked")},
 };
 assert.deepEqual(readDiaryTicket(blocked),{state:"UNAVAILABLE",key:null});
 assert.equal(stageDiaryTicket(blocked,keyA),false);
 assert.equal(clearVerifiedDiaryTicket(blocked,keyA),false);
 assert.deepEqual(readDiaryTicket(null),{state:"UNAVAILABLE",key:null});
 assert.equal(stageDiaryTicket(null,keyA),false);
});
test("PAP-1400 ticket rejects student identifiers and non-random/reused keys before mutation",()=>{
 const f=fake();
 for(const s of ["","student-1","center-1:student-1","foo-uuid-123","00000000-0000-0000-0000-000000000000"]){
  assert.equal(stageDiaryTicket(f.storage,s),false);
 }
 assert.equal(f.data.size,0);
 const silent:DiaryTicketStorage={
  getItem(){return null},
  setItem(){/* silently ignore write */},
  removeItem(){/* silently ignore delete */},
 };
 assert.equal(stageDiaryTicket(silent,keyA),false);
 const notCleared:DiaryTicketStorage={
  getItem(){return keyA},
  setItem(){},
  removeItem(){/* blocked silently */},
 };
 assert.equal(clearVerifiedDiaryTicket(notCleared,keyA),false);
});
