// PAP-2204: presentation only. Never use this classification for authorization.
export type AvatarPermissionSection = "profile" | "item" | "loadout" | "world" | "wish";
const sections: Readonly<Record<AvatarPermissionSection, readonly string[]>> = {
  profile: ["pinoria.avatar.directory.view", "pinoria.self.create", "pinoria.self.nickname.manage"],
  item: ["pinoria.self.item.view", "pinoria.self.item.manage"],
  loadout: ["pinoria.self.loadout.view", "pinoria.self.loadout.manage"],
  world: ["pinoria.world.avatar.view", "pinoria.world.avatar.grant", "pinoria.world.avatar.configure", "pinoria.world.avatar.set_live"],
  wish: ["pinoria.wish_event.view", "pinoria.wish_event.invalidate"],
};
export function avatarPermissionSection(permission: Readonly<{key: string; domain: string}>): AvatarPermissionSection | null {
  if (permission.domain !== "pinoria") return null;
  for (const section of Object.keys(sections) as AvatarPermissionSection[]) {
    if (sections[section].includes(permission.key)) return section;
  }
  return null;
}
export function avatarPermissionPresentation<T extends Readonly<{key: string; domain: string}>>(rows: readonly T[]) {
  const ordered: AvatarPermissionSection[] = ["profile", "item", "loadout", "world", "wish"];
  const buckets = new Map<AvatarPermissionSection | null, T[]>([...ordered.map(s => [s, [] as T[]] as const), [null, []]]);
  for (const row of rows) buckets.get(avatarPermissionSection(row))!.push(row);
  return [...buckets].filter(([, items]) => items.length > 0).map(([section, items]) => ({section, items}));
}
