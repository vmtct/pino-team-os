// PAP-1775 · unified slash tabs; old two-app entry links redirect to unified feed.
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { PinerUnified,type UnifiedTab } from "../UnifiedSpace";
type Props={params:Promise<{app:string}>};
export const dynamicParams=false;
export function generateStaticParams(){
 return ["grid","reels","community","hoi-hoa","piano"].map(app=>({app}));
}
export async function generateMetadata({params}:Props):Promise<Metadata>{
 const {app}=await params;
 const names:Record<string,string>={grid:"Bộ sưu tập",reels:"Reels",community:"Cộng đồng"};
 return {title:(names[app]||"Bảng tin")+" · Piner Space"};
}
export default async function UnifiedTabPage({params}:Props){
 const {app}=await params;
 if(app==="hoi-hoa"||app==="piano")redirect("/piner");
 if(app!=="grid"&&app!=="reels"&&app!=="community")notFound();
 return <PinerUnified tab={app as UnifiedTab}/>;
}
