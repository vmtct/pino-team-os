import { getCloudflareContext } from "@opennextjs/cloudflare";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Env = { GOOGLE_SSO_CLIENT_ID?: string };

export async function GET() {
  const { env } = await getCloudflareContext({ async: true }) as unknown as { env: Env };
  const clientId = env.GOOGLE_SSO_CLIENT_ID?.trim() ?? "";
  if (!clientId) {
    return Response.json(
      { error: { code: "GOOGLE_SSO_NOT_CONFIGURED", message: "Google SSO is not configured" } },
      { status: 503, headers: { "cache-control": "no-store" } },
    );
  }
  return Response.json(
    { data: { clientId } },
    { headers: { "cache-control": "no-store" } },
  );
}
