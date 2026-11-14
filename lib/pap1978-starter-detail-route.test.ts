import test from "node:test";
import assert from "node:assert/strict";
import {readStarterDetailRoute,starterDetailUrl} from "../app/ho/pinoria/starter-sets/starter-detail-route";
import {safeHoReturnTo} from "./ho-routes";
const id="0198d050-56c1-7ac5-b9ab-b0e45d912345",path="/ho/pinoria/starter-sets";
test("Starter immutable detail route restores exact selected tab and returns table",()=>{
 for(const tab of ["overview","members","history"] as const){const href=starterDetailUrl("https://ho.staging.pinohouse.art"+path,id,tab);assert.deepEqual(readStarterDetailRoute(new URL(href,"https://ho.staging.pinohouse.art").search),{record:id,tab});assert.equal(safeHoReturnTo(href),href);assert.equal(starterDetailUrl("https://ho.staging.pinohouse.art"+href,null),path);}
});
test("malformed or duplicate Starter detail route fails closed",()=>{
 for(const s of ["?record=bad","?record="+id+"&record="+id,"?record="+id+"&tab=secret","?record="+id+"&tab=history&tab=members"])assert.equal(readStarterDetailRoute(s),null);
 assert.equal(safeHoReturnTo(path+"?record="+id+"&tab=secret"),null);
 assert.equal(safeHoReturnTo("/ho/centers?record="+id+"&tab=history"),null);
});
