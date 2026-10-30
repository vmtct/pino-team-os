import assert from "node:assert/strict";
import test from "node:test";
import { saveCenterShiftRegistration } from "./bo-workforce-registration-command";
import type { boApi } from "./bo-api";

type Api = Pick<typeof boApi, "workforceWeekControl" | "setWorkforceAvailabilityRegistration">;
const valid = { centerId: "center-A", termWeekId: "global-week-W3", expectedVersion: 4, reason: "Manager cập nhật đăng ký", open: true };

function harness(ack: { open: boolean; version: number; exists?: boolean } = { open: true, version: 5 }) {
  const calls: Array<{ action: string; details?: unknown }> = [];
  const api = {
    setWorkforceAvailabilityRegistration: async (input: unknown, key: string) => {
      calls.push({ action: "write", details: { input, key } });
    },
    workforceWeekControl: async (center: string, week: string) => {
      calls.push({ action: "read", details: { center, week } });
      return { availability: {
        shiftPlanExists: ack.exists ?? true,
        availabilityRegistrationOpen: ack.open,
        controlVersion: ack.version,
      } };
    },
  } as unknown as Api;
  return { api, calls };
}

test("BO edit uses exact Center/week + CAS/reason/key and confirms Core readback", async () => {
  const { api, calls } = harness();
  const result = await saveCenterShiftRegistration({ ...valid, reason: "  Approved  " }, api, "unique-test-key");
  assert.deepEqual(result, { open: true, version: 5 });
  assert.deepEqual(calls, [
    { action: "write", details: { input: { ...valid, reason: "Approved" }, key: "unique-test-key" } },
    { action: "read", details: { center: valid.centerId, week: valid.termWeekId } },
  ]);
});

test("never claim success when Core readback disagrees, is stale or plan missing", async () => {
  for (const ack of [
    { open: false, version: 5 },
    { open: true, version: 4 },
    { open: true, version: 5, exists: false },
  ]) {
    const { api } = harness(ack);
    await assert.rejects(saveCenterShiftRegistration(valid, api, "test-key"), /Core chưa xác nhận/);
  }
});

test("invalid target/version/reason fail before write", async () => {
  for (const input of [{ ...valid, centerId: "" }, { ...valid, expectedVersion: -1 }, { ...valid, reason: "" }, { ...valid, reason: "x".repeat(501) }]) {
    const { api, calls } = harness();
    await assert.rejects(saveCenterShiftRegistration(input, api, "test-key"), /bắt buộc/);
    assert.deepEqual(calls, []);
  }
});

test("upstream 409/403 reject; no readback and no optimistic write", async () => {
  const calls: string[] = [];
  const api = {
    setWorkforceAvailabilityRegistration: async () => {
      calls.push("write");
      throw Object.assign(new Error("HTTP 409 stale"), { status: 409 });
    },
    workforceWeekControl: async () => { calls.push("read"); throw Error("should not read"); },
  } as unknown as Api;
  await assert.rejects(saveCenterShiftRegistration(valid, api, "test-key"), /409/);
  assert.deepEqual(calls, ["write"]);
});
