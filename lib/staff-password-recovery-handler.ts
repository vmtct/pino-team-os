import { TOS_HOSTNAME } from "./host-boundary";
import type { StaffPasswordEnv } from "./staff-password-core";

export interface StaffPasswordEmailBinding {
  send(message: {
    from: string;
    to: string;
    subject: string;
    text: string;
    html?: string;
  }): Promise<unknown>;
}

export interface StaffPasswordRecoveryEnv extends StaffPasswordEnv {
  PINO_STAFF_PASSWORD_EMAIL?: StaffPasswordEmailBinding;
  STAFF_PASSWORD_RESET_FROM_EMAIL?: string;
}

const ACCEPTED_MESSAGE = "Nếu email này đã đăng ký với PINO House, bạn sẽ nhận được liên kết đặt lại mật khẩu.";
const UNAVAILABLE_MESSAGE = "Hiện chưa thể gửi email đặt lại mật khẩu. Vui lòng thử lại sau.";

export async function handleForgotPassword(
  request: Request,
  env: StaffPasswordRecoveryEnv,
): Promise<Response> {
  if (request.method !== "POST") return json(405, { error: "METHOD_NOT_ALLOWED" });
  const input = await readJson(request);
  const email = typeof input?.email === "string" ? input.email.trim().toLowerCase() : "";
  if (!validEmail(email)) return json(400, { error: "INVALID_EMAIL", message: "Email không hợp lệ." });

  const sender = env.STAFF_PASSWORD_RESET_FROM_EMAIL?.trim();
  const mailer = env.PINO_STAFF_PASSWORD_EMAIL;
  const core = env.PINO_STAFF_PASSWORD_CORE;
  if (!sender || !validEmail(sender) || !mailer || !core.requestPasswordReset || !core.cancelPasswordReset) {
    return json(503, { error: "PASSWORD_RESET_UNAVAILABLE", message: UNAVAILABLE_MESSAGE });
  }
  let issued: { delivery: { email: string; token: string; expiresAt: string } | null };
  try {
    issued = await core.requestPasswordReset({ email });
  } catch {
    console.error("STAFF_PASSWORD_RESET_REQUEST_FAILED");
    return accepted();
  }

  if (!issued.delivery) return accepted();
  const delivery = issued.delivery;
  const resetUrl = `https://${TOS_HOSTNAME}/staff-password/reset#token=${encodeURIComponent(delivery.token)}`;
  try {
    await mailer.send({
      from: sender,
      to: delivery.email,
      subject: "Đặt lại mật khẩu PINO House",
      text: [
        "Bạn vừa yêu cầu đặt lại mật khẩu Staff tại PINO House.",
        "",
        `Mở liên kết này trong vòng 30 phút: ${resetUrl}`,
        "",
        "Nếu bạn không yêu cầu thao tác này, bạn có thể bỏ qua email.",
      ].join("\n"),
      html: `<p>Bạn vừa yêu cầu đặt lại mật khẩu Staff tại PINO House.</p><p><a href="${escapeHtml(resetUrl)}">Đặt lại mật khẩu</a></p><p>Liên kết có hiệu lực trong 30 phút.</p><p>Nếu bạn không yêu cầu thao tác này, bạn có thể bỏ qua email.</p>`,
    });
  } catch {
    console.error("STAFF_PASSWORD_RESET_EMAIL_DELIVERY_FAILED");
    try {
      await core.cancelPasswordReset({ token: delivery.token });
    } catch {
      console.error("STAFF_PASSWORD_RESET_CANCEL_FAILED");
    }
    return accepted();
  }
  return accepted();
}

export async function handleResetPassword(
  request: Request,
  env: StaffPasswordRecoveryEnv,
): Promise<Response> {
  if (request.method !== "POST") return json(405, { error: "METHOD_NOT_ALLOWED" });
  const input = await readJson(request);
  const token = typeof input?.token === "string" ? input.token : "";
  const password = typeof input?.password === "string" ? input.password : "";
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) {
    return resetRejected();
  }
  if (password.length < 10 || password.length > 128) {
    return json(400, {
      error: "INVALID_PASSWORD",
      message: "Mật khẩu mới phải có từ 10 đến 128 ký tự.",
    });
  }
  const core = env.PINO_STAFF_PASSWORD_CORE;
  if (!core.resetPassword) return resetUnavailable();
  try {
    await core.resetPassword({ token, password });
    return json(200, { reset: true });
  } catch {
    return resetRejected();
  }
}

function accepted(): Response {
  return json(202, { accepted: true, message: ACCEPTED_MESSAGE });
}

function resetRejected(): Response {
  return json(400, {
    error: "PASSWORD_RESET_REJECTED",
    message: "Không thể đặt mật khẩu mới. Liên kết có thể đã hết hạn, đã được dùng hoặc mật khẩu không hợp lệ.",
  });
}

function resetUnavailable(): Response {
  return json(503, {
    error: "PASSWORD_RESET_UNAVAILABLE",
    message: UNAVAILABLE_MESSAGE,
  });
}

async function readJson(request: Request): Promise<Record<string, unknown> | null> {
  try {
    const value = await request.json();
    return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
  } catch {
    return null;
  }
}
function validEmail(value: string): boolean {
  return value.length <= 320 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}
