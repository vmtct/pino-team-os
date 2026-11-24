import { getCloudflareContext } from "@opennextjs/cloudflare";
import { headers } from "next/headers";
import { BoPostsTdd } from "./BoPostsDraftEntry";
import { BoPostSubmitShell } from "../content/posts/BoPostSubmitShell";
export const dynamic = "force-dynamic";
export default async function PinerPostsPage({searchParams}:{searchParams:Promise<{m1Preview?:string}>}) {
 const incoming = await headers();
 const {env} = await getCloudflareContext({async:true}) as unknown as {env:{APP_ENV?:string}};
 const preview = env.APP_ENV === "staging" && incoming.get("host") === "bo.staging.pinohouse.art" && (await searchParams).m1Preview === "1";
 // Parent BO layout authenticates every request; fixture preview never opens a Core session.
 return preview ? <BoPostSubmitShell/> : <BoPostsTdd/>;
}
