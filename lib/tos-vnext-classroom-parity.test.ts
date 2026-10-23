import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const source=readFileSync(new URL("../app/components/tos-vnext/TosVNextClassroom.tsx",import.meta.url),"utf8");

test("PAP-945 class detail preserves V18b three-tab navigation and one contextual header",()=>{
 assert.match(source,/data-tos-vnext-class-tabs="v18b"/);
 assert.match(source,/TosVNextBottomNav label="Mục trong lớp học"/);
 for(const label of ["Học viên","Nhiệm vụ","Nhật ký"]){assert.ok(source.includes(`label:"${label}"`),`missing ${label} tab`)}
 assert.match(source,/setDetailTab\("students"\);setSelected\(row\)/);
 assert.equal((source.match(/data-tos-vnext="classroom-detail-header"/g)??[]).length,1);
});

test("PAP-945 does not claim unverified Path Diary or Mission writes",()=>{
 assert.match(source,/disabled title="Chưa triển khai thao tác mở Path Diary/);
 assert.match(source,/Đọc giáo án · chờ Core/);
 assert.match(source,/Ghi \/ đóng nhật ký · chờ Core/);
});

test("PAP-945 V18b bottom nav follows classroom content",()=>{
 const nav=source.indexOf('data-tos-vnext-class-tabs="v18b"');
 assert.ok(nav>source.indexOf('detailTab==="diary"'),"bottom nav must render after all three panels");
});
