import { getCloudflareContext } from "@opennextjs/cloudflare";
import type { StaffRegistrationDocumentInput, StaffRegistrationEnv, StaffRegistrationSubmissionInput } from "@/lib/staff-registration-core";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  try {
    const env = await registrationEnv();
    const state = await env.PINO_STAFF_REGISTRATION_CORE.status();
    return json({ data: { enabled: state.enabled } }, 200);
  } catch (cause) {
    if (isLocalPreview()) return json({ data: { enabled: true, preview: true } }, 200);
    return publicFailure(cause);
  }
}

export async function POST(request: Request): Promise<Response> {
  try {
    const input = await validate(await request.formData());
    const env = await registrationEnv();
    await env.PINO_STAFF_REGISTRATION_CORE.submit(input);
    return json({ data: { status: "PENDING" } }, 202);
  } catch (cause) {
    if (isLocalPreview() && !(cause instanceof ValidationError)) return json({ data: { status: "PENDING", preview: true } }, 202);
    return cause instanceof ValidationError ? json({ error: { message: cause.message } }, 400) : publicFailure(cause);
  }
}

async function registrationEnv(): Promise<StaffRegistrationEnv> {
  const { env } = await getCloudflareContext({ async: true }) as unknown as { env: StaffRegistrationEnv };
  if (!env?.PINO_STAFF_REGISTRATION_CORE?.status || !env.PINO_STAFF_REGISTRATION_CORE?.submit) throw new Error("STAFF_REGISTRATION_CORE_UNAVAILABLE");
  return env;
}
async function validate(form: FormData): Promise<StaffRegistrationSubmissionInput> {
  const displayLabel = required(form, "legalName", 160, "Vui lòng nhập họ và tên theo CCCD.");
  const email = required(form, "email", 320, "Vui lòng nhập email.").toLowerCase();
  const password = registrationPassword(form, "password");
  const confirmPassword = registrationPassword(form, "confirmPassword");
  if (password !== confirmPassword) throw new ValidationError("Mật khẩu xác nhận không khớp.");
  const mobile = required(form, "mobile", 30, "Vui lòng nhập số điện thoại.");
  const dateOfBirth = required(form, "dateOfBirth", 10, "Vui lòng nhập ngày sinh.");
  const currentAddress = required(form, "currentAddress", 500, "Vui lòng nhập địa chỉ hiện tại.");
  const governmentIdNumber = required(form, "governmentIdNumber", 12, "Vui lòng nhập số CCCD.");
  const bankName = required(form, "bankName", 120, "Vui lòng nhập ngân hàng.");
  const bankAccountNumber = required(form, "bankAccountNumber", 34, "Vui lòng nhập số tài khoản.");
  const bankAccountHolder = required(form, "bankAccountHolder", 160, "Vui lòng nhập tên chủ tài khoản.");
  const bankBranch = optional(form, "bankBranch", 160);
  if (!email.includes("@")) throw new ValidationError("Vui lòng nhập email hợp lệ.");
  if (!/^\d{9,12}$/.test(governmentIdNumber)) throw new ValidationError("Số CCCD không hợp lệ.");
  if (form.get("confirmAccuracy") !== "yes") throw new ValidationError("Vui lòng xác nhận tính chính xác của hồ sơ.");
  const governmentIdFront = await document(form, "governmentIdFront", "mặt trước CCCD");
  const governmentIdBack = await document(form, "governmentIdBack", "mặt sau CCCD");
  return { displayLabel, email, password, mobile, dateOfBirth, currentAddress, governmentIdNumber, bankName, bankAccountNumber, bankAccountHolder, bankBranch, governmentIdFront, governmentIdBack };
}

async function document(form: FormData, key: string, label: string): Promise<StaffRegistrationDocumentInput> {
  const value = form.get(key);
  if (!(value instanceof File) || value.size === 0) throw new ValidationError(`Vui lòng tải ${label}.`);
  if (value.size > 5 * 1024 * 1024) throw new ValidationError(`Ảnh ${label} phải nhỏ hơn 5 MB.`);
  if (!isImageType(value.type)) throw new ValidationError(`Ảnh ${label} phải là JPG, PNG hoặc WEBP.`);
  if (value.name.trim().length > 180) throw new ValidationError("Tên tệp CCCD quá dài.");
  return { fileName: value.name, mimeType: value.type, byteSize: value.size, body: await value.arrayBuffer() };
}
function required(form: FormData, key: string, max: number, message: string): string {
  const value = form.get(key);
  const normalized = typeof value === "string" ? value.trim() : "";
  if (!normalized || normalized.length > max) throw new ValidationError(message);
  return normalized;
}

function registrationPassword(form: FormData, key: string): string {
  const value = form.get(key);
  if (typeof value !== "string" || value.length < 10 || value.length > 128) {
    throw new ValidationError("Mật khẩu phải có từ 10 đến 128 ký tự.");
  }
  return value;
}

function optional(form: FormData, key: string, max: number): string | null {
  const value = form.get(key);
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  if (normalized.length > max) throw new ValidationError("Thông tin vượt quá giới hạn cho phép.");
  return normalized || null;
}

function isImageType(value: string): value is StaffRegistrationDocumentInput["mimeType"] {
  return value === "image/jpeg" || value === "image/png" || value === "image/webp";
}

function publicFailure(cause: unknown): Response {
  const code = cause && typeof cause === "object" && "code" in cause ? String((cause as { code?: unknown }).code ?? "") : "";
  if (code === "WORKFORCE_STAFF_REGISTRATION_CLOSED") return json({ error: { code, message: "Đăng ký nhân sự hiện đang đóng." } }, 409);
  return json({ error: { code: "STAFF_REGISTRATION_UNAVAILABLE", message: "Không thể gửi hồ sơ lúc này. Vui lòng thử lại sau." } }, 503);
}

function json(body: unknown, status: number): Response {
  return Response.json(body, { status, headers: { "cache-control": "no-store" } });
}

function isLocalPreview(): boolean { return process.env.NODE_ENV !== "production"; }
class ValidationError extends Error {}
