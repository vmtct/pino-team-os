import BoPayrollExceptionDetail from "./BoPayrollExceptionDetail";
export const dynamic="force-dynamic";
type Context={params:Promise<{requestId:string}>;searchParams:Promise<{tab?:string}>};
export default async function Page({params,searchParams}:Context){
 const [{requestId},{tab}]=await Promise.all([params,searchParams]);
 return <BoPayrollExceptionDetail requestId={requestId} activeTab={tab}/>;
}
