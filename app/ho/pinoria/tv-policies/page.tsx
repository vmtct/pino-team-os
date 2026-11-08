"use client";
import { HoWorkspace } from "@/app/ho/HoWorkspace";
import { TvPolicyDirectory } from "./TvPolicyDirectory";

/** PAP-1386 / PAP-1419: S3 replaces the S1 placeholder in the existing HO host. */
export default function HoTvPoliciesPage() {
  return <HoWorkspace module="tvPolicies" content={<TvPolicyDirectory />} />;
}
