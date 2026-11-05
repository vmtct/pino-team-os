import { getCloudflareContext } from "@opennextjs/cloudflare";
import { handleHoBills, type HoBillsEnv } from "@/lib/ho-bills-facade";
export const runtime = "nodejs";
async function handle(request: Request) {
  const {env} = await getCloudflareContext({async:true}) as unknown as {env:HoBillsEnv};
  return handleHoBills(request, env);
}
export const GET = handle;
export const POST = handle;
