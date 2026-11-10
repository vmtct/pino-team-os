// PAP-1805 · reuse one shell for either app; legacy subject-specific URLs redirect to House.
import {notFound,redirect} from "next/navigation";
import {PinerUnified,type UnifiedTab} from "../../UnifiedSpace";
import type {PinerSpace} from "../../spaces";
type Props={params:Promise<{app:string;tab:string}>};
export const dynamicParams=false;
export function generateStaticParams(){
 return ["house","mytime","hoi-hoa","piano"].flatMap(app=>["grid","reels","community"].map(tab=>({app,tab})));
}
export default async function SpaceTab({params}:Props){
 const {app,tab}=await params;
 if(!["grid","reels","community"].includes(tab))notFound();
 if(app==="hoi-hoa"||app==="piano")redirect("/piner/house/"+tab);
 if(app!=="house"&&app!=="mytime")notFound();
 return <PinerUnified tab={tab as UnifiedTab} space={app as PinerSpace}/>;
}
