// PAP-1805 · two distinct spaces share ONE unified renderer. Preserve legacy deep links.
import type {Metadata} from "next";
import {notFound,redirect} from "next/navigation";
import {PinerUnified,type UnifiedTab} from "../UnifiedSpace";
import type {PinerSpace} from "../spaces";
type Props={params:Promise<{app:string}>};
export const dynamicParams=false;
export function generateStaticParams(){return ["house","mytime","grid","reels","community","hoi-hoa","piano"].map(app=>({app}));}
export async function generateMetadata({params}:Props):Promise<Metadata>{
 const {app}=await params;
 return {title:(app==="mytime"?"MyTime":"PINO House")+" · Piner Space"};
}
export default async function SpaceRoot({params}:Props){
 const {app}=await params;
 if(["hoi-hoa","piano"].includes(app))redirect("/piner/house");
 if(["grid","reels","community"].includes(app))redirect("/piner/house/"+app);
 if(app!=="house"&&app!=="mytime")notFound();
 return <PinerUnified tab={"home" as UnifiedTab} space={app as PinerSpace}/>;
}
