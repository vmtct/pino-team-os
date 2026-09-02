import type { TrainingAssignmentDetail, TrainingSelfProjection } from "./training-model";

async function readOne<T>(path: string): Promise<T> {
  const response = await fetch(`/api/workforce/${path}`, { cache: "no-store" });
  const body = await response.json() as { data?: T; error?: { message?: string } };
  if (!response.ok || body.data === undefined) throw new Error(body.error?.message ?? "Không thể tải training.");
  return body.data;
}

async function writeOne<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(`/api/workforce/${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", "idempotency-key": crypto.randomUUID() },
    body: JSON.stringify(body),
  });
  const payload = await response.json() as { data?: T; error?: { message?: string } };
  if (!response.ok || payload.data === undefined) throw new Error(payload.error?.message ?? "Không thể cập nhật training.");
  return payload.data;
}

export const workforceTraining = {
  self: () => readOne<TrainingSelfProjection>("training/self"),
  completeLesson: (assignmentId: string, lessonKey: string) => writeOne<TrainingAssignmentDetail>(`training/assignments/${encodeURIComponent(assignmentId)}/lessons/complete`, { lessonKey }),
  submitAssessment: (assignmentId: string, score: number) => writeOne<TrainingAssignmentDetail>(`training/assignments/${encodeURIComponent(assignmentId)}/assessment`, { score }),
};
