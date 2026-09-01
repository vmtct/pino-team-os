import { BoShell, type BoNavGroup } from "@/app/components/tos-shell";
import { WardrobeAdminPrototype } from "@/app/bo/pinoria-wardrobe-prototype/WardrobeAdminPrototype";

const groups: BoNavGroup[] = [
  { label: "Prototype Review", items: [
    { href: "/pinoria/wardrobe-admin-prototype", label: "Wardrobe Admin" },
    { href: "/pinoria/wardrobe-prototype", label: "TOS Session Choice" },
  ] },
];

export default function Page() {
  return <BoShell title="PINO Team" subtitle="BO · Prototype Review" groups={groups} activeHref="/pinoria/wardrobe-admin-prototype">
    <WardrobeAdminPrototype basePath="/pinoria/wardrobe-admin-prototype" />
  </BoShell>;
}
