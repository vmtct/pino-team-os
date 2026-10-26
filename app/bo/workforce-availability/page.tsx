"use client";

import { BoWorkforceRoute } from "@/app/bo/architecture/BoWorkforceRoute";
import { moduleAdapter } from "./adapter";

export default function WorkforceAvailabilityPage() {
  return <BoWorkforceRoute moduleKey="workforce-availability" adapter={moduleAdapter} />;
}
