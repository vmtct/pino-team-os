import test from "node:test";
import assert from "node:assert/strict";
import {
  handleForgotPassword,
  type StaffPasswordRecoveryEnv,
} from "./staff-password-recovery-handler";
import {
  createTeamIsolatedEmailBoundary,
  type TeamEmailIsolatedTestAdmission,
} from "./test-support/staging-team-email-egress-boundary";

const TOKEN = "T".repeat(43);
const SOURCE_SHA = "e9a529a1edb648c60a246eae0f61874d105094c0";
const BASE: TeamEmailIsolatedTestAdmission = {
  environment: "staging",
  runtime: "local-node-test",
  database: "memory-only",
  sourceSha: SOURCE_SHA,
  bindings: [],
};
function request(email: string): Request {
  return new Request("https://tos.pinohouse.art/api/staff-auth/forgot-password", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email }),
  });
}
function makeEnv(
  mailer: StaffPasswordRecoveryEnv["PINO_STAFF_PASSWORD_EMAIL"],
  options: {
    delivery?: null | { email: string; token: string; expiresAt: string };
    cancelled?: string[];
    cancelThrows?: boolean;
  } = {},
): StaffPasswordRecoveryEnv {
  const core = {
    async establishFromCloudflare() {
      return {state:"ALREADY_CONFIGURED", loginIdentifier:"synthetic@example.invalid"};
    },
    async login() { throw Error("NOT_APPLICABLE"); },
    async status() { throw Error("NOT_APPLICABLE"); },
    async changePassword() { throw Error("NOT_APPLICABLE"); },
    async logout() { return {revoked:true}; },
    async requestPasswordReset() {
      return {
        delivery: options.delivery === undefined
          ? { email:"synthetic@example.invalid", token:TOKEN, expiresAt:"2026-10-24T15:30:00Z" }
          : options.delivery,
      };
    },
    async cancelPasswordReset(input: { token: string }) {
      options.cancelled?.push(input.token);
      if (options.cancelThrows) throw Error("CANCEL_FAILED");
      return {revoked:true};
    },
  };
  return {
    PINO_STAFF_PASSWORD_CORE: core,
    PINO_STAFF_PASSWORD_EMAIL: mailer,
    STAFF_PASSWORD_RESET_FROM_EMAIL: "no-reply@example.invalid",
  } as StaffPasswordRecoveryEnv;
}

test("Team real forgot-password handler exercises injected email deny and revokes issued token", async () => {
  const boundary = createTeamIsolatedEmailBoundary(BASE);
  const cancelled: string[] = [];
  const response = await handleForgotPassword(
    request("synthetic@example.invalid"),
    makeEnv(boundary.mailer, {cancelled}),
  );
  assert.equal(response.status, 202);
  assert.deepEqual(cancelled, [TOKEN]);
  const publicBody = await response.text();
  assert.doesNotMatch(publicBody, /T{20}|synthetic@example\.invalid/);
  assert.deepEqual(boundary.receipt(), {
    contract:"PAP973_TEAM_EMAIL_DENY_TEST_V1",
    emailPortAttemptsBlocked:1,
    emailMessagesPhysicallySent:0,
    runtimeScope:"INJECTED_LOCAL_NODE_TEST_ONLY",
    sharedStagingProvenSafe:false,
    writeTestAuthorized:false,
    productionMutation:false,
  });
});

test("unknown staff identity sends nothing and public result stays generic", async () => {
  const boundary = createTeamIsolatedEmailBoundary(BASE);
  const known = await handleForgotPassword(
    request("synthetic@example.invalid"),
    makeEnv(boundary.mailer),
  );
  const unknown = await handleForgotPassword(
    request("unknown@example.invalid"),
    makeEnv(boundary.mailer, {delivery:null}),
  );
  assert.equal(known.status, 202);
  assert.equal(unknown.status, 202);
  assert.equal(await known.text(), await unknown.text());
  assert.equal(boundary.receipt().emailPortAttemptsBlocked, 1);
  assert.equal(boundary.receipt().emailMessagesPhysicallySent, 0);
});

test("failed revocation never leaks token or exposes staff existence", async () => {
  const boundary = createTeamIsolatedEmailBoundary(BASE);
  const response = await handleForgotPassword(
    request("synthetic@example.invalid"),
    makeEnv(boundary.mailer, {cancelThrows:true}),
  );
  assert.equal(response.status, 202);
  const body = await response.text();
  assert.doesNotMatch(body, /T{20}|synthetic@example\.invalid/);
  assert.equal(boundary.receipt().emailMessagesPhysicallySent, 0);
  assert.equal(boundary.receipt().emailPortAttemptsBlocked, 1);
});

test("disposable-only admission rejects shared stage, production, sender/service or secrets", () => {
  const invalid = [
    {...BASE,environment:"production"},
    {...BASE,runtime:"pino-team-os-staging"},
    {...BASE,database:"pino-core-staging"},
    {...BASE,sourceSha:"main"},
    {...BASE,bindings:[{name:"PINO_STAFF_PASSWORD_EMAIL",type:"send_email"}]},
    {...BASE,bindings:[{name:"PINO_STAFF_PASSWORD_CORE",type:"service"}]},
    {...BASE,bindings:[{name:"DB",type:"d1"}]},
    {...BASE,bindings:[{name:"SPEEDSMS_ACCESS_TOKEN",type:"secret_text"}]},
    {...BASE,bindings:[{name:"MEDIA",type:"r2_bucket"}]},
  ];
  for (const item of invalid) {
    assert.throws(
      () => createTeamIsolatedEmailBoundary(item as TeamEmailIsolatedTestAdmission),
      /PAP973_TEAM_EMAIL_TEST_ADMISSION_DENIED/,
    );
  }
});

test("receipt remains bounded and contains no recipient, token, source SHA or reset link", async () => {
  const boundary = createTeamIsolatedEmailBoundary(BASE);
  await assert.rejects(boundary.mailer.send({
    from:"no-reply@example.invalid",to:"synthetic@example.invalid",
    subject:"PINO synthetic",text:"reset-token="+TOKEN,
  }), /PAP973_EMAIL_OUTBOUND_BLOCKED/);
  const json=JSON.stringify(boundary.receipt());
  for(const secret of [TOKEN,SOURCE_SHA,"synthetic@example.invalid","reset-token="])
    assert.equal(json.includes(secret),false);
});
