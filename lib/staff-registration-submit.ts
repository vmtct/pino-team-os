export const STAFF_REGISTRATION_TIMEOUT_MS = 45_000;

export type RegistrationResult =
  | { kind: "accepted" }
  | { kind: "rejected"; message: string }
  | { kind: "unknown" };

// PAP-2361: timeout covers both upload/headers and response body. A client
// deadline or transport failure is not evidence that Core did not persist.
export async function submitStaffRegistration(
  form: FormData,
  fetcher: typeof fetch = fetch,
  timeoutMs = STAFF_REGISTRATION_TIMEOUT_MS,
): Promise<RegistrationResult> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<RegistrationResult>((resolve) => {
    timer = setTimeout(() => {
      resolve({ kind: "unknown" });
      controller.abort();
    }, timeoutMs);
  });
  const request = async (): Promise<RegistrationResult> => {
    try {
      const response = await fetcher("/api/staff-registration", {
        method: "POST", body: form, signal: controller.signal,
      });
      const body = await response.json() as {
        data?: { status?: string }; error?: { message?: string };
      };
      if (response.status === 202 && body?.data?.status === "PENDING") {
        return { kind: "accepted" };
      }
      if (response.status === 400 || response.status === 409) {
        return { kind: "rejected", message: body?.error?.message ?? "Không thể gửi hồ sơ nhân sự." };
      }
      return { kind: "unknown" };
    } catch {
      return { kind: "unknown" };
    }
  };
  try {
    return await Promise.race([request(), deadline]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}
