"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { shortDisplayName } from "@/lib/display-name";
import { workforceApi, type StaffProfile } from "@/lib/workforce-api";
import styles from "./tos-shell.module.css";

let profilePromise: Promise<StaffProfile | null> | null = null;

function loadProfile() {
  if (!profilePromise) {
    profilePromise = workforceApi.profile().then((result) => result.data).catch(() => null);
  }
  return profilePromise;
}

function useCurrentProfile() {
  const [profile, setProfile] = useState<StaffProfile | null>(null);
  useEffect(() => {
    let current = true;
    void loadProfile().then((value) => { if (current) setProfile(value); });
    return () => { current = false; };
  }, []);
  return profile;
}

export function TosCurrentUserChip() {
  const profile = useCurrentProfile();
  const name = shortDisplayName(profile?.displayLabel);
  const initial = Array.from(name)[0] ?? "P";
  return (
    <Link className={styles.userChip} href="/info" aria-label={name ? `Hồ sơ của ${name}` : "Hồ sơ của tôi"}>
      <span>{initial}</span>
      <strong>{name || "Hồ sơ"}</strong>
    </Link>
  );
}

export function TosGreeting() {
  const profile = useCurrentProfile();
  const name = shortDisplayName(profile?.displayLabel);
  return <>{name ? `Chào ${name} 👋` : "Chào bạn 👋"}</>;
}
