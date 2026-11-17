import BoPayrollDailyDetail from "./BoPayrollDailyDetail";
export const dynamic="force-dynamic";
type Props={params:Promise<{staffMemberId:string;workDate:string}>;
 searchParams:Promise<{tab?:string}>};
export default async function Page({params,searchParams}:Props){
 const [{staffMemberId,workDate},{tab}]=await Promise.all([params,searchParams]);
 return <BoPayrollDailyDetail staffMemberId={staffMemberId} workDate={workDate} activeTab={tab}/>;
}
