// PAP-2423 / WFM-STAFF: presentation-only directory view selection.
import type {StaffsView} from "@/app/bo/components/registration/BoStaffsViews";
export function parseHoStaffView(value:unknown):StaffsView{
 return value==="register"||value==="active"||value==="deactivated"?value:"all";
}
export function hoStaffViewRows<T extends {status?:unknown}>(rows:readonly T[],view:StaffsView):T[]{
  if(view==="register")return [];
  return rows.filter(row=>view==="active"?row.status==="\u0110ang l\u00e0m":view==="deactivated"?row.status==="Ng\u01b0ng":row.status==="\u0110ang l\u00e0m"||row.status==="Ng\u01b0ng");
}
