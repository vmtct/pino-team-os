// PAP-1542 / PAP-220 — retired standalone Staff link page.
import { redirect } from "next/navigation";

const CENTER_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export default async function LegacyStaffLinksRedirect({
  searchParams,
}: {
  searchParams: Promise<{ record?: string | string[] }>;
}) {
  const { record } = await searchParams;
  const center = typeof record === "string" && CENTER_ID.test(record) ? record : null;
  redirect("/ho/centers" + (center ? "?record=" + encodeURIComponent(center) : ""));
}
