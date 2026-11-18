import {headers} from "next/headers";
import {notFound} from "next/navigation";
import OpeningEvidenceDetail from "./OpeningEvidenceDetail";
import {openingEvidencePageSubject} from "@/lib/opening-evidence-page-route";
type Props={params:Promise<{subjectType:string;receiptId:string}>;searchParams:Promise<{tab?:string}>};
export default async function Page({params,searchParams}:Props){
  const host=(await headers()).get("host")?.toLowerCase().split(":")[0]??"";
  if(host!=="bo.staging.pinohouse.art")notFound();
  const [{subjectType,receiptId},{tab}]=await Promise.all([params,searchParams]);
  const subject=openingEvidencePageSubject(subjectType);
  if(!subject||!/^[0-9a-f-]{36}$/.test(receiptId))notFound();
  return <OpeningEvidenceDetail subjectType={subject} receiptId={receiptId} activeTab={tab}/>;
}
