import type { BoNavGroup } from "@/app/components/tos-shell";

export const boNavigation: BoNavGroup[] = [
  {
    label: "Workspace",
    items: [{ href: "/bo", label: "Hôm nay" }],
  },
  {
    label: "School",
    items: [
      { href: "/bo/learners", label: "Students" },
      { label: "Subscriptions" },
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
      { label: "Schedule" },
    ],
  },
  {
    label: "Operations",
    items: [{ href: "/bo/open-studio", label: "Open Studio" }],
  },
  {
    label: "Learning",
    items: [
      { href: "/bo/syllabus", label: "Programs & Syllabus" },
      { href: "/bo/practice", label: "Practice" },
    ],
  }  ,{
    label: "Workforce",
    items: [
      { href: "/bo/staff", label: "Staff" },
      { href: "/bo/workforce", label: "Schedule & Time" },
      { href: "/bo/training", label: "Training" },
    ],
  },
  {
    label: "Pinoria",
    items: [
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
        href: "/bo/pinoria-ward",
        label: "Wardrobe",
        children: [
          { href: "/bo/pinoria-ward", label: "Catalog" },
          { href: "/bo/pinoria-ward/sets", label: "Sets" },
        ],
      },
    ],
  },
  {
    label: "Content",
    items: [{ href: "/bo/content", label: "Website CMS" }],
  },
  {
    label: "System",
    items: [      {
        href: "/bo/system/users",
        label: "Access",
        children: [
          { href: "/bo/system/users", label: "Users" },
          { href: "/bo/system/roles", label: "Roles" },
        ],
      },
      { label: "Policies" },
      { href: "/bo/system/audit", label: "Audit" },
    ],
  },
];
