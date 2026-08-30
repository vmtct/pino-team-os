export type WorkforceCorrectionResult<T> =
  | { state: "REPLACED"; replacement: T }
  | { state: "CANCELLED_ONLY"; error: unknown };

export async function correctWorkforceAssignment<T>(
  cancel: () => Promise<unknown>,
  createReplacement: () => Promise<T>,
): Promise<WorkforceCorrectionResult<T>> {
  await cancel();
  try {
    return { state: "REPLACED", replacement: await createReplacement() };
  } catch (error) {
    return { state: "CANCELLED_ONLY", error };
  }
}
