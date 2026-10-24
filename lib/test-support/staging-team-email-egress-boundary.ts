/**
 * PAP-973 test-only capability. This does not alter deployed Team OS Workers,
 * their email binding, or Cloudflare Access. Test adapters only.
 */
import type { StaffPasswordEmailBinding } from "../staff-password-recovery-handler";

export interface TeamEmailIsolatedTestAdmission {
  environment: "staging";
  runtime: "local-node-test";
  database: "memory-only";
  sourceSha: string;
  bindings: ReadonlyArray<{ name: string; type: string }>;
}

interface EmailDeniedReceipt {
  contract: "PAP973_TEAM_EMAIL_DENY_TEST_V1";
  emailPortAttemptsBlocked: number;
  emailMessagesPhysicallySent: 0;
  runtimeScope: "INJECTED_LOCAL_NODE_TEST_ONLY";
  sharedStagingProvenSafe: false;
  writeTestAuthorized: false;
  productionMutation: false;
}

export function createTeamIsolatedEmailBoundary(input: TeamEmailIsolatedTestAdmission): {
  mailer: StaffPasswordEmailBinding;
  receipt: () => EmailDeniedReceipt;
} {
  const bindings: unknown = input?.bindings;
  if (!input ||
      input.environment !== "staging" ||
      input.runtime !== "local-node-test" ||
      input.database !== "memory-only" ||
      !/^[a-f0-9]{40}$/i.test(input.sourceSha) ||
      !Array.isArray(bindings) ||
      input.bindings.some((binding: { name: string; type: string }) =>
        !binding ||
        typeof binding.name !== "string" ||
        typeof binding.type !== "string" ||
        /SPEEDSMS|ZALO|PAYMENT|STRIPE|SEND_EMAIL|PINO_STAFF_PASSWORD_EMAIL|PROD/i.test(binding.name) ||
        ["service", "d1", "r2_bucket", "send_email", "secret_text"].includes(binding.type))) {
    throw new Error("PAP973_TEAM_EMAIL_TEST_ADMISSION_DENIED");
  }

  let blocked = 0;
  return {
    mailer: {
      send() {
        // Never inspect, serialize, log or forward message/token/recipient.
        blocked += 1;
        return Promise.reject(new Error("PAP973_EMAIL_OUTBOUND_BLOCKED"));
      },
    },
    receipt: () => ({
      contract: "PAP973_TEAM_EMAIL_DENY_TEST_V1",
      emailPortAttemptsBlocked: blocked,
      emailMessagesPhysicallySent: 0,
      runtimeScope: "INJECTED_LOCAL_NODE_TEST_ONLY",
      sharedStagingProvenSafe: false,
      writeTestAuthorized: false,
      productionMutation: false,
    }),
  };
}
