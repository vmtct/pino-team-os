"use client";
/** PAP-2242: local-only M1 preview, using the actual DSA Workshop detail and Participation shell. */
import { useState } from "react";
import { TddDetail } from "@/app/components/workspace-renderer/Record";
import { WorkshopParticipationTab } from "@/app/components/mytime-workshop/WorkshopParticipationTab";
import { workshopBinding, type WorkshopFields } from "@/app/components/mytime-workshop/schema";
import type { AuthorizationContext, ModuleRow } from "@/lib/workspace-schema";

const readPermission = "learning.mytime_workshop.bo_view";
const binding = workshopBinding(
  "BO",
  { centers: ["M1 Preview Center"], missions: [], specialties: [], staff: [] },
  {
    read: readPermission,
    history: readPermission,
    create: "learning.mytime_workshop.ho_manage",
    edit: "learning.mytime_workshop.ho_manage",
  },
);
const localReadContext: AuthorizationContext = {
  surface: "BO",
  centerId: "pap2242-local-review-center",
  authorize: (permission: string) => permission === readPermission,
};
const sampleWorkshop = {
  id: "pap2242-local-review-workshop",
  name: "Open Studio · Bản xem thử",
  center: "M1 Preview Center",
  startAt: "2026-11-21T18:00:00+07:00",
  endAt: "2026-11-21T19:30:00+07:00",
  missions: [],
  specialty: null,
  capacity: 12,
  status: "Đã lên lịch",
  eventLead: null,
  academicLead: null,
  otherStaff: [],
  facebookUrl: null,
  note: "Synthetic local review only. No Core data or persistence.",
  createdAt: null,
  createdBy: null,
  updatedAt: null,
  updatedBy: null,
} satisfies ModuleRow<WorkshopFields>;

export function Pap2242ParticipationReview() {
  const [activeTab, setActiveTab] = useState("participation");
  return <main className="mx-auto max-w-6xl space-y-4 p-4">
    <p role="note">PAP-2242 · M1 local review only. Workshop is synthetic; no session, Core read, or write is used.</p>
    <TddDetail
      registry={binding.registry}
      schema={binding.schema}
      context={localReadContext}
      record={sampleWorkshop}
      subject={{ type: "mytime_workshop", id: sampleWorkshop.id }}
      onBack={() => setActiveTab("overview")}
      activeTab={activeTab}
      onTabChange={setActiveTab}
      renderApprovedExtension={(_record, context, tab) => tab === "participation" ? <WorkshopParticipationTab
        workshopId={sampleWorkshop.id}
        centerId="pap2242-local-review-center"
        workshopName={sampleWorkshop.name}
        centerName={sampleWorkshop.center}
        rows={[]}
        context={context}
        canCreate
        unavailable
      /> : null}
    />
  </main>;
}
