import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function ScheduleRedirect({ searchParams }: { searchParams: Promise<{ t?: string; week?: string; debug?: string }> }) {
  const params = await searchParams;
  const query = new URLSearchParams();
  if (params.t) query.set("t", params.t);
  if (params.week) query.set("week", params.week);
  if (params.debug) query.set("debug", params.debug);
  redirect(`/dashboard${query.toString() ? `?${query.toString()}` : ""}`);
}
