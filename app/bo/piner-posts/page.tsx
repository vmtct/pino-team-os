import { getCloudflareContext } from "@opennextjs/cloudflare";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { BoPostsTdd } from "./BoPostsDraftEntry";
import { parsePostReviewQuery } from "./post-preview-query";
export const dynamic = "force-dynamic";
export default async function PinerPostsPage({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}) {
 const incoming=await headers();
 const {env}=await getCloudflareContext({async:true}) as unknown as {env:{APP_ENV?:string}};
 const staging=env.APP_ENV==="staging"&&incoming.get("host")==="bo.staging.pinohouse.art";
 if(!staging)return <BoPostsTdd/>;
 // Canonical Staging fixture; legacy m1Preview normalizes, selected-Center gate retained.
 const params=new URLSearchParams();
 for(const [k,v] of Object.entries(await searchParams)){if(typeof v==="string")params.append(k,v);else if(Array.isArray(v))for(const item of v)params.append(k,item);}
 const query=parsePostReviewQuery(params);
 if(!query)notFound();
 if(query.legacy)redirect("/bo/piner-posts"+(query.canonical?"?"+query.canonical:""));
 return <BoPostsTdd previewMode/>;
}
