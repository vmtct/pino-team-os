import { PresenceRosterAccessActivation } from "./PresenceRosterAccessActivation";
import { StaffOnboardingView } from "./StaffOnboardingView";
import { StaffManagementView } from "./StaffManagementView";
import { StaffRegistrationSection } from "./StaffRegistrationSection";


export default function StaffPage() {
  return (
    <>
      <StaffRegistrationSection />
      <StaffManagementView />
      <PresenceRosterAccessActivation />
      <StaffOnboardingView />
    </>
  );
}
