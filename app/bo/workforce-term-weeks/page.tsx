"use client";

import { BoModuleFactory } from "@/app/bo/architecture/BoModuleFactory";
import { moduleAdapter } from "./adapter";

export default function WorkforceTermWeeksPage() {
  return <BoModuleFactory moduleKey="workforce-term-weeks" adapter={moduleAdapter} />;
}
