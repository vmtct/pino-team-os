import type { BoNavGroup } from "@/app/components/tos-shell";

export const boNavigation: BoNavGroup[] = [
  {
    label: "Workspace",
    items: [{ href: "/bo", label: "Hôm nay" }, { href: "/bo/workforce-shift-plans", label: "Center Shift Plans" }, { href: "/bo/workforce-availability", label: "Staff Availability" }, { href: "/bo/workforce-assignments", label: "Shift Assignments" }],
  },
  {
    label: "School",
    items: [
      { href: "/bo/learners", label: "Students" },
      { href: "/bo/student-visits", label: "Student Visits" },
      { href: "/bo/subscriptions", label: "Subscriptions" },
      {
        href: "/bo/running-classes",
        label: "Classes",
        children: [
          { href: "/bo/running-classes", label: "Lớp đang chạy" },
          { href: "/bo/sessions", label: "Sessions" },
          { href: "/bo/registrations", label: "Registrations" },
          { href: "/bo/delivery-activation", label: "Activation" },
        ],
      },
      { href: "/bo/calendar", label: "Schedule", children: [{ href: "/bo/calendar", label: "Holidays & closures" }] },
    ],
  },
  {
    label: "Operations",
    items: [
      { href: "/bo/sales/leads", label: "Leads" },
      { href: "/bo/open-studio", label: "Open Studio" },
      { href: "/bo/open-studio-passes", label: "Pass Trạm Nghệ Thuật" },
      { href: "/bo/tvs", label: "TVs" },
    ],
  },
  {
    label: "Learning",
    items: [
      { href: "/bo/syllabus", label: "Programs & Syllabus" },
      { href: "/bo/missions", label: "Nhiệm vụ" },
      { href: "/bo/practice", label: "Practice" },
    ],
  }  ,{
    label: "Workforce",
    items: [
      { href: "/bo/staff", label: "Staff" },
      { href: "/bo/workforce", label: "Schedule & Time" },
      { href: "/bo/workforce/check-in-exceptions", label: "Check-in Exceptions" },
      { href: "/bo/workforce/timekeeping", label: "Timekeeping" },
      { href: "/bo/workforce/compensation", label: "Lịch sử lương" },
      { href: "/bo/workforce/duty-exceptions", label: "Duty Exceptions" },
      { href: "/bo/workforce/payroll", label: "Kỳ lương" },
      { href: "/bo/payroll-periods", label: "Kỳ lương (Read-only)" },
      { href: "/bo/workforce/payroll/extra-time", label: "Duyệt thêm giờ" },
      { href: "/bo/training", label: "Training" },
    ],
  },
  {
    label: "Pinoria",
    items: [
      { href: "/bo/pinoria-avatars", label: "Self Directory" },
      {
        href: "/bo/pinoria-wish",
        label: "Economy",
        children: [
          { href: "/bo/pinoria-wish", label: "Wish" },
          { href: "/bo/pinoria-activities", label: "Activity" },
        ],
      },
      {
        href: "/bo/pinoria-companions",
        label: "Collection",
        children: [{ href: "/bo/pinoria-companions", label: "Companions" }],
      },
      {
        href: "/bo/pinoria-ward/learners",
        label: "Wardrobe",
        children: [
          { href: "/bo/pinoria-ward/learners", label: "Loadouts" },
        ],
      },
      { href: "/bo/pinoria-effects", label: "Effects" },
      { href: "/bo/pinoria-tv-policy", label: "TV Projection Policy" },
      { href: "/bo/pinoria-tv-operator", label: "TV Operations" },
    ],
  },
  {
    label: "Content",
    items: [{ href: "/bo/content", label: "Website CMS" }],
  },
  {
    label: "System",
    items: [      { href: "/bo/system/policies", label: "Policies" },
      { href: "/bo/system/ai-data", label: "AI Data Inbox" },
      { href: "/bo/system/pancake", label: "Pancake" },
      { href: "/bo/system/audit", label: "Audit" },
    ],
  },
];
