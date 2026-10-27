"use client";

import { BoWorkforceRoute } from "@/app/bo/architecture/BoWorkforceRoute";
import { moduleAdapter } from "./adapter";

export default function WorkforceTermWeeksPage() {
  return <BoWorkforceRoute moduleKey="workforce-term-weeks" adapter={moduleAdapter} />;
}
