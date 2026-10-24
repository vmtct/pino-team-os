import { PresenceRosterAccessActivation } from "./PresenceRosterAccessActivation";
import { StaffOnboardingView } from "./StaffOnboardingView";
import { StaffManagementView } from "./StaffManagementView";
import { StaffRegistrationIntakeToggle } from "./StaffRegistrationIntakeToggle";
import { StaffRegistrationReviewQueue } from "./StaffRegistrationReviewQueue";
import styles from "../bo.module.css";

/** Existing Staff source workflows remain mounted; shortcuts navigate, never mutate. */
export default function StaffPage() {
  return (
    <>
      <nav className={styles.staffLandingNav} aria-label="Điều hướng quản lý nhân viên">
        <a href="#staff-management"><strong>Danh sách Staff</strong><small>Tìm kiếm, hồ sơ và Access</small></a>
        <a href="#add-staff"><strong>Thêm nhân viên</strong><small>Khởi tạo Staff theo quy trình hiện có</small></a>
        <a href="#staff-registration-review"><strong>Duyệt đăng ký</strong><small>Tiếp nhận và xử lý yêu cầu</small></a>
        <a href="#staff-registration-intake"><strong>Mở đăng ký</strong><small>Điều khiển tiếp nhận Staff</small></a>
        <a href="#staff-presence-activation"><strong>Kích hoạt ca</strong><small>Roster và quyền vào ca</small></a>
        <a href="#staff-onboarding"><strong>Onboarding</strong><small>Kết nối Staff và Access</small></a>
      </nav>
      <div id="staff-registration-intake"><StaffRegistrationIntakeToggle /></div>
      <div id="staff-registration-review"><StaffRegistrationReviewQueue /></div>
      <StaffManagementView />
      <div id="staff-presence-activation"><PresenceRosterAccessActivation /></div>
      <div id="staff-onboarding"><StaffOnboardingView /></div>
    </>
  );
}
