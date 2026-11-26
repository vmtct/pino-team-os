import { getCloudflareContext } from "@opennextjs/cloudflare";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { BoPostsTdd } from "./BoPostsDraftEntry";
import { parseNativePostQuery } from "./native-post-query";
export const dynamic = "force-dynamic";
export default async function PinerPostsPage({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}) {
 const incoming=await headers();
 const {env}=await getCloudflareContext({async:true}) as unknown as {env:{APP_ENV?:string}};
 const staging=env.APP_ENV==="staging"&&incoming.get("host")==="bo.staging.pinohouse.art";
 if(!staging)notFound();
 // PAP-2386: canonical authenticated Staging native runtime, never a fixture fallback.
 const params=new URLSearchParams();
 for(const [k,v] of Object.entries(await searchParams)){if(typeof v==="string")params.append(k,v);else if(Array.isArray(v))for(const item of v)params.append(k,item);}
 const query=parseNativePostQuery(params);
 if(!query)notFound();
 return <BoPostsTdd/>;
}
