"use client";

import { BoWorkforceRoute } from "@/app/bo/architecture/BoWorkforceRoute";
import { moduleAdapter } from "./adapter";

export default function WorkforceShiftPlansPage() {
  return <BoWorkforceRoute moduleKey="workforce-shift-plans" adapter={moduleAdapter} />;
}
