import { StaffTdd } from "./StaffTdd";
import { forbidden, redirect } from "next/navigation";
import { HO_PAGE_PATHS, retiredStaffReviewRoute } from "@/lib/ho-routes";
export const dynamic = "force-dynamic";

// PAP-2353 · HO Manual Staff Creation retired; existing Staff directory is canonical.
export default async function HoStaffPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const outcome = retiredStaffReviewRoute(await searchParams);
  if (outcome === "invalid") forbidden();
  if (outcome === "redirect") redirect(HO_PAGE_PATHS.staffs);
  return <StaffTdd />;
}
