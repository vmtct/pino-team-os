import type { BoRecord } from "@/lib/bo-registration";
/** Seed for isolated M1 adapter only; never emitted by a live reader. */
export const STAFF_DIRECTORY_MOCK_ID="STAFF-DIRECTORY-MOCK-001";
export function staffDirectoryFixture(): BoRecord {
  return {id:STAFF_DIRECTORY_MOCK_ID,name:"Nh\u00e2n s\u1ef1 m\u1eabu PINO",status:"active",department:"V\u1eadn h\u00e0nh",role:"Staff",createdAt:"2026-11-26T08:00:00.000Z",createdBy:"M1 Fixture",updatedAt:"2026-11-26T08:00:00.000Z",updatedBy:"M1 Fixture"};
}
