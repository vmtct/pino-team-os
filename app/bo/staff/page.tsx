import { PresenceRosterAccessActivation } from "./PresenceRosterAccessActivation";
import { StaffOnboardingView } from "./StaffOnboardingView";
import { StaffManagementView } from "./StaffManagementView";
import { StaffRegistrationIntakeToggle } from "./StaffRegistrationIntakeToggle";
import { StaffRegistrationReviewQueue } from "./StaffRegistrationReviewQueue";

export default function StaffPage() {
  return (
    <>
      <StaffRegistrationIntakeToggle />
      <StaffRegistrationReviewQueue />
      <StaffManagementView />
      <PresenceRosterAccessActivation />
      <StaffOnboardingView />
    </>
  );
}
