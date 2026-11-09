// PAP-1775 · retire old app-specific nested route URLs via canonical unified tab redirects.
import { notFound, redirect } from "next/navigation";
type Props={params:Promise<{app:string;tab:string}>};
export const dynamicParams=false;
export function generateStaticParams(){
 return ["hoi-hoa","piano"].flatMap(app=>["grid","reels","community"].map(tab=>({app,tab})));
}
export default async function RetiredAppTabRedirect({params}:Props){
 const {app,tab}=await params;
 if(!["hoi-hoa","piano"].includes(app))notFound();
 if(!["grid","reels","community"].includes(tab))notFound();
 redirect("/piner/"+tab);
}
