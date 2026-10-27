"use client";

import { BoWorkforceRoute } from "@/app/bo/architecture/BoWorkforceRoute";
import { moduleAdapter } from "./adapter";

export default function WorkforceAssignmentsPage() {
  return <BoWorkforceRoute moduleKey="workforce-assignments" adapter={moduleAdapter} />;
}
