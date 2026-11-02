"use client";

import { useEffect, useState } from "react";
import { boApi } from "@/lib/bo-api";

/** UI capability only; every command still goes through subject-scoped Core ACL. */
export function useBoEditPermission(permission: string) {
  const [capability, setCapability] = useState({ permission: "", allowed: false });
  useEffect(() => {
    let active = true;
    void boApi.context().then(context => {
      if (active) setCapability({ permission, allowed: context.surface === "BO" && context.entitled === true && Array.isArray(context.permissionKeys) && context.permissionKeys.includes(permission) });
    }).catch(() => { if (active) setCapability({ permission, allowed: false }); });
    return () => { active = false; };
  }, [permission]);
  return capability.permission === permission && capability.allowed;
}
