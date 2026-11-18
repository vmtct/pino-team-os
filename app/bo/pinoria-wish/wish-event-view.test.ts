import test from "node:test";
import assert from "node:assert/strict";
import {wishEventRow,wishOutcomeRows} from "./wish-event-view";
import type {BoWishDetail} from "@/lib/pls-wish-bo-contract";
const row={eventId:"event",learnerName:"QA Student",learnerGender:"FEMALE",centerName:null,bannerName:"QA Banner",count:2,spent:200,highestRarity:5,status:"COMMITTED",createdAt:"2026-11-17T00:00:00.000Z",actorName:null,reversedAt:null,reversedByName:null,outcomes:[{ordinal:1,itemId:"same",itemRevision:3,rarity:5,duplicate:false,itemName:null,provenance:"WISH_DRAW",grantEventId:"grant"},{ordinal:2,itemId:"same",itemRevision:3,rarity:5,duplicate:true,itemName:"QA Item",provenance:null,grantEventId:null}]} as BoWishDetail;
test("Wish BO projection retains PLS, audit nulls, ordered duplicate outcomes and distinct row keys",()=>{
 const r=wishEventRow(row);assert.equal(r.name,"QA Student ♀");assert.equal(r.spent,200);assert.equal(r.actor,null);assert.equal(r.center,null);
 const items=wishOutcomeRows(row);assert.equal(items.length,2);assert.notEqual(items[0].id,items[1].id);assert.equal(items[0].name,"—");assert.equal(items[1].grantEventId,null);
 const reversed=wishEventRow({...row,status:"INVALIDATED",reversedAt:"2026-11-17T01:00:00.000Z",reversedByName:"QA Manager"});assert.equal(reversed.reversedBy,"QA Manager");
});
