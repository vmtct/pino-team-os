"use client";

import { BoModuleFactory } from "@/app/bo/architecture/BoModuleFactory";
import { moduleAdapter } from "./adapter";

export default function WorkforceShiftPlansPage() {
  return <BoModuleFactory moduleKey="workforce-shift-plans" adapter={moduleAdapter} />;
}
