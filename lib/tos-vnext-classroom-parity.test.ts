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

test("PAP-945 surfaces Core roster conflict without treating it as a completed diary",()=>{
 assert.match(source,/student\.status==="CONFLICT"/);
 assert.match(source,/role="alert"/);
 assert.match(source,/Kiểm tra trước khi ghi nhật ký/);
 assert.match(source,/setRefresh\(x=>x\+1\)/);
});

test('PAP-945 opening evidence remains visibly Core-gated, never simulated',()=>{
 assert.match(source,/Mở lớp · chụp ảnh setup: chờ Core xác nhận lượt mở và bằng chứng/);
 assert.match(source,/Vào lớp/);
 assert.doesNotMatch(source,/Đã mở lớp thành công/);
 assert.doesNotMatch(source,/Ảnh setup đã lưu/);
});
