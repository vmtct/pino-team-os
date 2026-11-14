import {headers} from "next/headers";
import {notFound} from "next/navigation";
import OpeningEvidenceDetail from "./OpeningEvidenceDetail";
type Props={params:Promise<{subjectType:string;receiptId:string}>;searchParams:Promise<{tab?:string}>};
export default async function Page({params,searchParams}:Props){
  const host=(await headers()).get("host")?.toLowerCase().split(":")[0]??"";
  if(host!=="bo.staging.pinohouse.art")notFound();
  const [{subjectType,receiptId},{tab}]=await Promise.all([params,searchParams]);
  if((subjectType!=="CLASS"&&subjectType!=="RECEPTION")||!/^[0-9a-f-]{36}$/.test(receiptId))notFound();
  return <OpeningEvidenceDetail subjectType={subjectType} receiptId={receiptId} activeTab={tab}/>;
}
