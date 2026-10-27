import type { BoModule, BoRecord } from "./bo-registration";
import type { BoAccessRole, BoCenter } from "./bo-model";
import type { BoAccessRoleDetail, BoAccessSystemUser } from "./bo-access-model";
import { hoCentersModule, mapHoCenters } from "./ho-centers";
import {hoA1Modules,type HoA1Module} from "./ho-a1";
import { HO_PAGE_PATHS } from "./ho-routes";

export type HoModule = "centers" | "users" | "roles" | "audits" | HoA1Module;
export const hoRoutes: Record<HoModule, string> = HO_PAGE_PATHS;
export const hoModules: Record<HoModule,BoModule> = {
 centers: {...hoCentersModule,group:"Network"},
 ...hoA1Modules,
 users: {label:"Users",group:"System",fields:[
  {key:"name",label:"Account",type:"text",icon:"Aa",w:260,readonly:true},
  {key:"id",label:"User ID",type:"id",icon:"#",w:270,readonly:true},
  {key:"status",label:"Status",type:"select",icon:"◉",w:115,readonly:true},
  {key:"staffMemberId",label:"Staff link",type:"id",icon:"@",w:270,readonly:true},
  {key:"roleAssignments",label:"Assigned roles / scopes",type:"multiselect",icon:"▦",w:320,readonly:true},
 ]},
 roles: {label:"Roles",group:"System",fields:[
  {key:"name",label:"Display Name",type:"text",icon:"Aa",w:220,readonly:true},
  {key:"id",label:"Role ID",type:"id",icon:"#",w:265,readonly:true},
  {key:"roleKey",label:"Role Key",type:"text",icon:"⌘",w:180,readonly:true},
  {key:"roleType",label:"Type",type:"select",icon:"▣",w:100,readonly:true},
  {key:"status",label:"Status",type:"select",icon:"◉",w:110,readonly:true},
  {key:"permissionCount",label:"Permissions",type:"number",icon:"≡",w:110,readonly:true},
  {key:"assignmentCount",label:"Assignments",type:"number",icon:"@",w:120,readonly:true},
  {key:"permissionKeys",label:"Permission Membership",type:"multiselect",icon:"▦",w:340,readonly:true},
  {key:"description",label:"Description",type:"textarea",icon:"≡",w:250,readonly:true},
 ]},
 audits: {label:"Access Audit",group:"System",fields:[{key:"name",label:"Event",type:"text",icon:"≡",w:250,readonly:true}]},
};
export const mapHoUsers = (rows: BoAccessSystemUser[]): BoRecord[] => rows.map(u=>({
 id:u.id,name:u.email ?? u.id,status:u.status,staffMemberId:u.staffMemberId,
 roleAssignments:u.assignments.map(a=>[a.roleName,a.scopeType,a.scopeId].filter(Boolean).join(" · ")),
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
