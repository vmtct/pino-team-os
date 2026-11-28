// PAP-2420: native HO dossier queue metadata, separate from Staff employment.
import {manualStaffDefinition,manualStaffQuery,type ManualStaffFields} from "./manual-create-contract";
import type {TableQuery} from "@/lib/workspace-schema";
const columns=["name","center","status","createdAt","createdBy","updatedAt","updatedBy"] as const;
const keys=["name","status"] as const;
const sections=manualStaffDefinition.drawer.sections.map(s=>s.id==="staff-info"?{...s,label:"Thông tin hồ sơ đăng ký",fields:s.fields.filter(k=>k!=="role"&&k!=="loginEmail")}:s);
export const registrationQueueDefinition={...manualStaffDefinition,label:"Hồ sơ đăng ký",table:{...manualStaffDefinition.table,columns:columns.map(field=>({field,visible:true})),search:{...manualStaffDefinition.table.search,fields:keys},filters:{...manualStaffDefinition.table.filters,fields:keys},sort:{...manualStaffDefinition.table.sort,fields:keys},group:{...manualStaffDefinition.table.group,fields:["status"] as const}},drawer:{...manualStaffDefinition.drawer,sections},detail:{...manualStaffDefinition.detail,overview:{sections},businessTabs:[]}} as const;
export const registrationQueueQuery:TableQuery<ManualStaffFields>={...manualStaffQuery,order:columns,visible:columns};
