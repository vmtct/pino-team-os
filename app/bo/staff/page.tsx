import { F2LearningOperatorActivation } from "./F2LearningOperatorActivation";
import { StaffOnboardingView } from "./StaffOnboardingView";
import { StaffManagementView } from "./StaffManagementView";

export default function StaffPage() {
  return (
    <>
      <StaffManagementView />
      <StaffOnboardingView />
      <F2LearningOperatorActivation />
    </>
  );
}
