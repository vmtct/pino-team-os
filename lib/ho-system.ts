import type { BoModule, BoRecord } from "./bo-registration";
import type { BoAccessRole, BoCenter, BoStaffRecord } from "./bo-model";
import type { BoAccessRoleDetail, BoAccessSystemUser } from "./bo-access-model";
import { hoCentersModule, mapHoCenters } from "./ho-centers";
import {hoA1Modules,type HoA1Module} from "./ho-a1";
import { HO_PAGE_PATHS } from "./ho-routes";

export type HoModule = "centers" | "walkinPasses" | "termWeeks" | "staffs" | "users" | "roles" | "audits" | "tddReference" | HoA1Module;
export const hoRoutes: Record<HoModule, string> = HO_PAGE_PATHS;
export const hoModules: Record<HoModule,BoModule> = {
 tddReference: {label:"TDD Reference",group:"System",fields:[{key:"name",label:"Demo",type:"text",icon:"Aa",w:240,readonly:true}]},
 centers: {...hoCentersModule,group:"Network"},
 termWeeks:{label:"TermWeek",group:"Workforce",fields:[
  {key:"name",label:"Tuần",type:"text",icon:"Aa",w:235,readonly:true},
  {key:"code",label:"Mã tuần",type:"text",icon:"#",w:130,readonly:true},
  {key:"startDate",label:"Bắt đầu",type:"date",icon:"◷",w:145,readonly:true},
  {key:"endDate",label:"Kết thúc",type:"date",icon:"◷",w:145,readonly:true},
  {key:"rhythmKey",label:"Nhịp",type:"text",icon:"Aa",w:140,readonly:true},
 ]},
 walkinPasses:{label:"Pass Trạm Nghệ Thuật",group:"Open Studio",fields:[
  {key:"code",label:"Mã Pass",type:"text",icon:"#",w:260,readonly:true},
  {key:"status",label:"Trạng thái",type:"text",icon:"◉",w:145,readonly:true},
  {key:"path",label:"Path",type:"text",icon:"▣",w:115,readonly:true},
  {key:"parent",label:"Parent ID",type:"text",icon:"@",w:260,readonly:true},
  {key:"center",label:"Center ID",type:"text",icon:"⌖",w:260,readonly:true},
 ]},
 staffs:{label:"Staff",group:"Nhân sự",fields:[
  {key:"name",label:"Nhân sự",type:"text",icon:"Aa",w:220,readonly:true},
  {key:"id",label:"Staff ID",type:"id",icon:"#",w:240,readonly:true},
  {key:"status",label:"Trạng thái",type:"select",icon:"◉",w:120,readonly:true},
  {key:"roleLabel",label:"Chức danh",type:"text",icon:"Aa",w:170,readonly:true},
  {key:"department",label:"Bộ phận",type:"text",icon:"Aa",w:170,readonly:true},
 ]},
 ...hoA1Modules,
 users: {label:"Users",group:"System",fields:[
  {key:"name",label:"Account",type:"text",icon:"Aa",w:260,readonly:true},
  {key:"id",label:"User ID",type:"id",icon:"#",w:270,readonly:true},
  {key:"status",label:"Status",type:"select",icon:"◉",w:115,readonly:true},
  {key:"staffMemberId",label:"Staff link",type:"id",icon:"@",w:270,readonly:true},
  {key:"roleAssignments",label:"Assigned roles / scopes",type:"multiselect",icon:"▦",w:320,readonly:true},
 ]},
 roles: {label:"Roles",group:"System",fields:[
  {key:"name",label:"Tên vai trò",type:"text",icon:"Aa",w:280,readonly:true},
  {key:"id",label:"Role ID",type:"id",icon:"#",w:265,readonly:true,defaultVisible:false},
  {key:"roleKey",label:"Role Key",type:"text",icon:"⌘",w:180,readonly:true,defaultVisible:false},
  {key:"roleType",label:"Loại",type:"select",icon:"▣",w:110,readonly:true},
  {key:"status",label:"Trạng thái",type:"select",icon:"◉",w:120,readonly:true},
  {key:"permissionCount",label:"Số quyền",type:"number",icon:"≡",w:110,readonly:true},
  {key:"assignmentCount",label:"Số phân công",type:"number",icon:"@",w:135,readonly:true},
  {key:"permissionKeys",label:"Danh sách quyền",type:"multiselect",icon:"▦",w:340,readonly:true,defaultVisible:false},
  {key:"description",label:"Mô tả",type:"textarea",icon:"≡",w:250,readonly:true,defaultVisible:false},
 ]},
 audits: {label:"Access Audit",group:"System",fields:[{key:"name",label:"Event",type:"text",icon:"≡",w:250,readonly:true}]},
};
export const mapHoStaffs=(rows:BoStaffRecord[]):BoRecord[]=>rows.map(r=>({id:r.id,name:r.displayLabel,status:r.status,roleLabel:r.roleLabel,department:r.department}));
export const mapHoUsers = (rows: BoAccessSystemUser[]): BoRecord[] => rows.map(u=>({
 id:u.id,name:u.email ?? u.id,status:u.status,staffMemberId:u.staffMemberId,
 roleAssignments:u.assignments.map(a=>[a.roleName,a.scopeType,a.scopeId].filter(Boolean).join(" · ")),
}));
export const mapHoRoleDirectory = (roles: BoAccessRole[]): BoRecord[] => roles.map(role=>({
 id:role.id,name:role.displayName,roleKey:role.roleKey,roleType:role.roleType,
 status:role.status,description:role.description,permissionCount:role.permissionCount,
 assignmentCount:role.assignmentCount,permissionKeys:[],
}));
export const mapHoRoles = (roles: BoAccessRole[],details: BoAccessRoleDetail[]): BoRecord[] => {
 const byId=new Map(details.map(d=>[d.id,d]));
 return roles.map(role=>{
  const d=byId.get(role.id);
  if (!d) throw new Error("Thiếu dữ liệu chi tiết Role.");
  return {id:role.id,name:role.displayName,roleKey:role.roleKey,roleType:role.roleType,status:role.status,description:role.description,
    permissionCount:role.permissionCount,assignmentCount:role.assignmentCount,permissionKeys:d.permissionKeys};
 });
};
export {mapHoCenters};
