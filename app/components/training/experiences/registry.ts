import { createTrainingExperienceRegistry } from "@/lib/training-experience";
import { classroomDiaryScenarioV1 } from "./ClassroomDiaryScenarioV1";

export const trainingExperienceRegistry = createTrainingExperienceRegistry([
  classroomDiaryScenarioV1,
]);
