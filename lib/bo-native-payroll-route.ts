/** PAP-1970 · Native BO payroll route grammar, no retired Engine or write capability. */
const UUID="[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
const DAILY="/bo/payroll-daily", EXCEPTIONS="/bo/payroll-exceptions";
const API_DAILY="/api/bo/workforce/payroll/daily", API_EXCEPTIONS="/api/bo/workforce/payroll/read-only/extra-time/reviews";
export type NativePayrollModule="payroll-daily"|"payroll-exceptions";
function dateValid(date:string):boolean {
 if(!/^\d{4}-\d{2}-\d{2}$/.test(date))return false;
 const epoch=Date.parse(date+"T00:00:00Z");
 return Number.isFinite(epoch)&&new Date(epoch).toISOString().slice(0,10)===date;
}
function dailyDetail(path:string,base:string):boolean{
 const m=new RegExp("^"+base+"/("+UUID+")/(\\d{4}-\\d{2}-\\d{2})$").exec(path);
 return !!m&&dateValid(m[2]!);
}
function exceptionDetail(path:string,base:string):boolean{return new RegExp("^"+base+"/"+UUID+"$").test(path);}
export function nativePayrollModule(path:string):NativePayrollModule|null{
 if(path===DAILY||dailyDetail(path,DAILY))return "payroll-daily";
 if(path===EXCEPTIONS||exceptionDetail(path,EXCEPTIONS))return "payroll-exceptions";
 return null;
}
export function isNativePayrollApi(path:string):boolean{
 return path===API_DAILY||dailyDetail(path,API_DAILY)||path===API_EXCEPTIONS||exceptionDetail(path,API_EXCEPTIONS);
}
export function isNativePayrollNamespace(path:string):boolean{
 return [DAILY,EXCEPTIONS,API_DAILY,API_EXCEPTIONS].some(root=>path===root||path.startsWith(root+"/"));
}
