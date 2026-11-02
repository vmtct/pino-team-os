import test from "node:test";
import assert from "node:assert/strict";
import {visibleBoSidebarGroups, toggleBoSidebarGroup, collapseAllBoSidebarGroups} from "./bo-sidebar-state";
const groups = [{label:"Học viên",items:[{label:"Đăng ký",href:"/bo/enrollments"},{label:"Students",href:"/bo/learners"}]},{label:"Workforce",items:[{label:"Nhân sự",href:"/bo/staff"}]}];
test("collapsed groups are hidden but search temporarily reveals matched entries",()=>{
 const collapsed=["Học viên"];
 assert.deepEqual(visibleBoSidebarGroups(groups,{collapsed,query:""})[0].items,[]);
 assert.deepEqual(visibleBoSidebarGroups(groups,{collapsed,query:"dang ky"})[0].items.map(i=>i.label),["Đăng ký"]);
 assert.deepEqual(visibleBoSidebarGroups(groups,{collapsed,query:""})[0].items,[]);
});
test("search is case and Vietnamese diacritic insensitive",()=>{
 assert.deepEqual(visibleBoSidebarGroups(groups,{collapsed:[],query:"NHAN SU"}).map(i=>i.label),["Workforce"]);
 assert.deepEqual(visibleBoSidebarGroups(groups,{collapsed:[],query:"HOC VIEN"})[0].items.length,2);
});
test("toggle, collapse all, expand all retain explicit state",()=>{
 assert.deepEqual(toggleBoSidebarGroup(["Học viên"],"Học viên"),[]);
 assert.deepEqual(collapseAllBoSidebarGroups(groups),["Học viên","Workforce"]);
 assert.equal(visibleBoSidebarGroups(groups,{collapsed:[],query:""}).length,2);
});
