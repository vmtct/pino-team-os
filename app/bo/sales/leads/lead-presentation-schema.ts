/** PAP-2288 / PLT-LEAD: existing Lead presentation metadata, consumed by native Table/Drawer/Detail.
 * This is not a TDD_DEFAULT admission or an authorization grant. */
import {LEAD_M1_AUDIT_COLUMNS} from "./lead-household-m1-fixtures";
export const CONTACT_FIELD_SCHEMA=[
 {key:"contactName",label:"Người liên hệ"},
 {key:"phone",label:"Số điện thoại",required:true},
] as const;
export const LEAD_TABLE_COLUMNS={
 contact:{key:"contact",header:"Người liên hệ",minWidth:210,sticky:true},
 phone:{key:"phone",header:"Số điện thoại",minWidth:140},
 household:{key:"household",header:"Thành viên",minWidth:170},
 interest:{key:"interest",header:"Chương trình quan tâm",minWidth:230},
 source:{key:"source",header:"Nguồn",minWidth:150},
 lifecycle:{key:"lifecycle",header:"Trạng thái",minWidth:120},
} as const;
export const LEAD_AUDIT_TABLE_COLUMNS=LEAD_M1_AUDIT_COLUMNS.map(field=>({...field,header:field.label,minWidth:field.type==="datetime"?150:130}));
export const LEAD_DETAIL_TABS={
 detail:{id:"detail",label:"Tổng quan"},
 members:{id:"members",label:"Thành viên"},
 relationships:{id:"relationships",label:"Quan hệ"},
 history:{id:"history",label:"Lịch sử"},
} as const;
export function leadFixtureFilterable(key:string,canonicalRead:boolean):boolean{
 return !canonicalRead&&(key===LEAD_TABLE_COLUMNS.phone.key||key===LEAD_TABLE_COLUMNS.lifecycle.key);
}
