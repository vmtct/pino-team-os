import test from "node:test";
import assert from "node:assert/strict";
import {createElement} from "react";
import {renderToStaticMarkup} from "react-dom/server";
import {HoSetMemberControls} from "../app/ho/pinoria/wardrobe/HoSetMemberControls";

function render(index:number,total:number,displayName:string,editable=true){
 return renderToStaticMarkup(createElement(HoSetMemberControls,{
  index,total,displayName,editable,onMoveUp:()=>{},onMoveDown:()=>{},onRemove:()=>{}
 }));
}
test("PAP-1287 renders distinct named remove/move actions for each SET member",()=>{
 const hair=render(0,2,"Tóc Mori");
 const face=render(1,2,"Khuôn mặt Mori");
 assert.match(hair,/aria-label="Bỏ Tóc Mori khỏi Set \(thành viên 1\)"/);
 assert.match(face,/aria-label="Bỏ Khuôn mặt Mori khỏi Set \(thành viên 2\)"/);
 assert.match(hair,/aria-label="Đưa Tóc Mori lên \(thành viên 1\)"/);
 assert.match(face,/aria-label="Đưa Khuôn mặt Mori xuống \(thành viên 2\)"/);
 assert.equal((hair.match(/aria-label=/g)||[]).length,3);
 assert.equal((face.match(/aria-label=/g)||[]).length,3);
 assert.notEqual(hair.match(/aria-label="Bỏ [^"]+"/)?.[0],face.match(/aria-label="Bỏ [^"]+"/)?.[0]);
});
test("PAP-1287 preserves movement boundary and read-only semantics",()=>{
 const first=render(0,2,"Tóc Mori");
 const last=render(1,2,"Khuôn mặt Mori");
 assert.match(first,/aria-label="Đưa Tóc Mori lên \(thành viên 1\)" disabled=""/);
 assert.match(last,/aria-label="Đưa Khuôn mặt Mori xuống \(thành viên 2\)" disabled=""/);
 const readonly=render(0,2,"Tóc Mori",false);
 assert.equal((readonly.match(/ disabled=""/g)||[]).length,3);
});
