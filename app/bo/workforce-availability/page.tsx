"use client";

import { BoModuleFactory } from "@/app/bo/architecture/BoModuleFactory";
import { moduleAdapter } from "./adapter";

export default function WorkforceAvailabilityPage() {
  return <BoModuleFactory moduleKey="workforce-availability" adapter={moduleAdapter} />;
}
