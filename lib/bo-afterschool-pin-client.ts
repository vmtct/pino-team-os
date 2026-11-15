type PinCommand = "issue-initial" | "reset";

type PinReceipt = {
  parentId: string;
  centerId: string;
  expiresAt: string;
  temporaryPin: string;
  credentialVersion: number;
};

export async function requestBoAfterschoolPin(
  command: PinCommand,
  parentId: string,
  centerId: string,
  confirmedPhone: string,
): Promise<PinReceipt> {
  const id = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
  if (!id.test(parentId) || !id.test(centerId)) throw new Error("Cần chọn tài khoản và cơ sở hợp lệ.");
  const query = new URLSearchParams({ centerId });
  const response = await fetch("/api/bo/identity/afterschool-users/" + parentId + "/pin/" + command + "?" + query, {
    method: "POST",
    credentials: "same-origin",
    mode: "same-origin",
    cache: "no-store",
    redirect: "error",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ confirmedPhone }),
  });
  if (!response.ok) throw new Error("Không thể cấp PIN. Kiểm tra quyền, cơ sở và số điện thoại.");
  const { data } = await response.json() as { data?: Partial<PinReceipt> };
  if (!data || data.parentId !== parentId || data.centerId !== centerId ||
      typeof data.temporaryPin !== "string" || !/^\d{6}$/.test(data.temporaryPin) ||
      typeof data.expiresAt !== "string" || !Number.isFinite(Date.parse(data.expiresAt)) ||
      typeof data.credentialVersion !== "number" || !Number.isSafeInteger(data.credentialVersion) ||
      data.credentialVersion < 1) {
    throw new Error("Không thể xác minh kết quả cấp PIN.");
  }
  return {
    parentId, centerId, temporaryPin: data.temporaryPin,
    expiresAt: data.expiresAt, credentialVersion: data.credentialVersion,
  };
}
