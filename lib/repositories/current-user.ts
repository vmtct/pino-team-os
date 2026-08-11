import { headers } from "next/headers";
import { listStaff } from "@/lib/repositories/staff";
import type { Staff } from "@/lib/domain/staff";

export type CurrentIdentity = {
  userId: string;
  email: string;
  name: string;
};

export async function currentIdentity(): Promise<CurrentIdentity | null> {
  const requestHeaders = await headers();
  const userId = requestHeaders.get("x-pino-user-id") ?? "";
  const email = requestHeaders.get("x-pino-user-email") ?? "";
  const name = requestHeaders.get("x-pino-user-name") ?? "";

  if (!userId && !email) return null;
  return { userId, email, name };
}

export async function currentStaff(): Promise<Staff | null> {
  const identity = await currentIdentity();
  if (!identity) return null;

  const staff = await listStaff();
  const byUserId = identity.userId
    ? staff.find((person) => person.userId === identity.userId)
    : undefined;
  if (byUserId) return byUserId;

  return identity.email
    ? staff.find((person) => person.email.toLowerCase() === identity.email.toLowerCase()) ?? null
    : null;
}
