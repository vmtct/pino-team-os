import { createTrainingExperienceRegistry } from "@/lib/training-experience";
import { classroomDiaryScenarioV1 } from "./ClassroomDiaryScenarioV1";
import { pinoPhotoMissionV1 } from "./PinoPhotoMissionV1";

export const trainingExperienceRegistry = createTrainingExperienceRegistry([
  classroomDiaryScenarioV1,
  pinoPhotoMissionV1,
]);
