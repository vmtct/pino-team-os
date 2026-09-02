import { F2LearningOperatorActivation } from "./F2LearningOperatorActivation";
import { StaffOnboardingView } from "./StaffOnboardingView";
import { StaffManagementView } from "./StaffManagementView";
import { StaffRegistrationIntakeToggle } from "./StaffRegistrationIntakeToggle";
import { StaffRegistrationReviewQueue } from "./StaffRegistrationReviewQueue";

export default function StaffPage() {
  return (
    <>
      <StaffRegistrationIntakeToggle />
      <StaffManagementView />
      <StaffOnboardingView />
      <F2LearningOperatorActivation />
    </>
  );
}
