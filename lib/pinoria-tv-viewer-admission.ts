/** PAP-650 / PNR-TV · PAP-1646: UI-only fail-closed viewer states.
 * HTTP success is not an authorization or published Policy proof.
 * Server/Core must independently verify principal, resource/Center, published state.
 */
export type PolicyViewerBlockedReason =
  | "login_required"
  | "access_denied"
  | "not_found"
  | "unavailable";

export type PolicyViewerAccessCopy = Readonly<{
  heading: string;
  description: string;
}>;

const COPY: Record<PolicyViewerBlockedReason, PolicyViewerAccessCopy> = {
  login_required: {
    heading: "Cần đăng nhập",
    description: "Đăng nhập hợp lệ qua TOS hoặc HO để xem TV trong phạm vi được cấp quyền.",
  },
  access_denied: {
    heading: "Không có quyền truy cập",
    description: "Tài khoản hiện tại không có quyền xem chính sách trình chiếu này.",
  },
  not_found: {
    heading: "Không tìm thấy TV",
    description: "Chính sách trình chiếu không tồn tại hoặc không thể truy cập.",
  },
  unavailable: {
    heading: "Pinoria TV chưa sẵn sàng",
    description: "Chưa thể tải trình chiếu từ Core được cấp quyền. Vui lòng thử lại sau.",
  },
};

export function policyViewerBlockedReasonForHttpStatus(
  status: number,
): PolicyViewerBlockedReason {
  if (status === 401) return "login_required";
  if (status === 403) return "access_denied";
  if (status === 404) return "not_found";
  // Includes 200: transport success does NOT establish authenticated access
  // or an authorized published Policy projection.
  return "unavailable";
}

export function policyViewerBlockedCopy(
  reason: PolicyViewerBlockedReason,
): PolicyViewerAccessCopy {
  return COPY[reason] ?? COPY.unavailable;
}
