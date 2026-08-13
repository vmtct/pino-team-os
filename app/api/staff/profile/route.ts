import { NextResponse } from "next/server";
import { appendFileUploadsToPage, uploadNotionFile } from "@/lib/notion";
import { staffByUsername } from "@/lib/repositories/staff-access";
import { missingStaffProfileFields, staffProfile, updateStaffProfile, type StaffProfile } from "@/lib/repositories/staff-profile";

export const dynamic = "force-dynamic";

const ALLOWED = new Set<keyof StaffProfile>([
  "email", "dateOfBirth", "gender", "cccd", "idIssueDate", "idIssuePlace", "address", "employmentType", "department", "startDate", "role",
]);
const MAX_FILE_BYTES = 20 * 1024 * 1024;
const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp"]);

type DocumentUpload = { file: File; label: "front" | "back" };

function validateDocument(file: File | null, label: "front" | "back"): DocumentUpload | null {
  if (!file || file.size === 0) return null;
  if (!ALLOWED_MIME.has(file.type)) throw new Error(`${label === "front" ? "Mặt trước" : "Mặt sau"}: chỉ nhận JPG, PNG hoặc WebP.`);
  if (file.size > MAX_FILE_BYTES) throw new Error(`${label === "front" ? "Mặt trước" : "Mặt sau"}: file vượt quá 20MB.`);
  return { file, label };
}

function extension(file: File): string {
  const fromName = file.name.split(".").pop()?.toLowerCase();
  if (fromName && /^[a-z0-9]+$/.test(fromName)) return fromName;
  return file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
}

export async function POST(request: Request) {
  try {
    const url = new URL(request.url);
    const username = url.searchParams.get("t")?.trim() ?? "";
    if (!username) return NextResponse.json({ ok: false, error: "missing_username" }, { status: 400 });

    const staff = await staffByUsername(username);
    if (!staff) return NextResponse.json({ ok: false, error: "invalid_staff_link" }, { status: 404 });

    const contentType = request.headers.get("content-type") ?? "";
    let input: Partial<StaffProfile> = {};
    const uploads: DocumentUpload[] = [];

    if (contentType.includes("multipart/form-data")) {
      const form = await request.formData();
      for (const key of ALLOWED) {
        const value = form.get(key);
        if (typeof value === "string") (input as Record<string, string>)[key] = value.trim();
      }
      const front = form.get("cccdFront");
      const back = form.get("cccdBack");
      if (front instanceof File) {
        const validated = validateDocument(front, "front");
        if (validated) uploads.push(validated);
      }
      if (back instanceof File) {
        const validated = validateDocument(back, "back");
        if (validated) uploads.push(validated);
      }
    } else {
      const body = await request.json().catch(() => null);
      if (!body || typeof body !== "object") return NextResponse.json({ ok: false, error: "invalid_body" }, { status: 400 });
      for (const [key, value] of Object.entries(body as Record<string, unknown>)) {
        if (!ALLOWED.has(key as keyof StaffProfile) || typeof value !== "string") continue;
        (input as Record<string, string>)[key] = value.trim();
      }
    }

    await updateStaffProfile(staff, input);

    if (uploads.length) {
      const uploaded = [] as Array<{ id: string; name: string }>;
      for (const upload of uploads) {
        const side = upload.label === "front" ? "mat-truoc" : "mat-sau";
        const name = `CCCD-${side}.${extension(upload.file)}`;
        const id = await uploadNotionFile(upload.file, name);
        uploaded.push({ id, name });
      }
      await appendFileUploadsToPage(staff.id, "ID Documents", uploaded);
    }

    const profile = await staffProfile(staff);
    return NextResponse.json({ ok: true, profile, missing: missingStaffProfileFields(profile) });
  } catch (error) {
    console.error("[Staff Profile] update failed", error);
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "profile_update_failed" }, { status: 500 });
  }
}
