import { getCloudflareContext } from "@opennextjs/cloudflare";
import { headers } from "next/headers";
import { BoPostsTdd } from "./BoPostsDraftEntry";
export const dynamic = "force-dynamic";
export default async function PinerPostsPage({searchParams}:{searchParams:Promise<{m1Preview?:string}>}) {
 const incoming = await headers();
 const {env} = await getCloudflareContext({async:true}) as unknown as {env:{APP_ENV?:string}};
 const staging = env.APP_ENV === "staging" && incoming.get("host") === "bo.staging.pinohouse.art";
 const preview = staging && (await searchParams).m1Preview === "1";
 // Parent BO layout authenticates every request; fixture preview never opens a Core session.
 return preview ? <BoPostsTdd previewMode/> : <BoPostsTdd allowPreview={staging}/>;
}
