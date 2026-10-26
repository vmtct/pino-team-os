"use client";

import { BoModuleFactory } from "@/app/bo/architecture/BoModuleFactory";
import { moduleAdapter } from "./adapter";

export default function WorkforceAssignmentsPage() {
  return <BoModuleFactory moduleKey="workforce-assignments" adapter={moduleAdapter} />;
}
