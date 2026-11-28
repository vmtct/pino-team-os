import type { BoField, BoModule, BoRecord } from "@/lib/bo-registration";
/** PAP-2411: presentation only; no unscoped profile or access query. */
const field = (key: string, label: string, type: BoField["type"], w: number, icon: string): BoField => ({key,label,type,w,icon,readonly:true});
export function staffDirectoryPresentationRow(row:BoRecord):BoRecord {
  return {...row,status:row.status==="active"?"\u0110ang l\u00e0m":row.status==="inactive"?"Ng\u01b0ng ho\u1ea1t \u0111\u1ed9ng":row.status};
}
export const staffDirectoryModule: BoModule = {label:"Nh\u00e2n s\u1ef1",group:"WORKFORCE",fields:[
  field("name","Nh\u00e2n s\u1ef1","text",225,"Aa"),
  field("status","Tr\u1ea1ng th\u00e1i l\u00e0m vi\u1ec7c","select",155,"\u25a3"),
  field("department","B\u1ed9 ph\u1eadn","text",155,"Aa"),
  field("role","Vai tr\u00f2","text",150,"Aa"),
  {...field("id","Staff ID","id",165,"#"),defaultVisible:false},
  field("createdAt","Created Time","datetime",170,"\u25a6"),
  field("createdBy","Created By","text",145,"Aa"),
  field("updatedAt","Last Modified Time","datetime",170,"\u25a6"),
  field("updatedBy","Last Modified By","text",145,"Aa"),
]};
