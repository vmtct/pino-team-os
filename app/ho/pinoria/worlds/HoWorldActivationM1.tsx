"use client";
/** PAP-2143 / PNR-WORLD: same native activation UI on authenticated Staging. */
import {useMemo} from "react";
import {TddPreferencePolicy} from "@/app/components/workspace-renderer/Record";
import {HoWorldCatalog} from "./HoWorldCatalog";
import {createWorldStagingBoundary} from "./world-activation-staging-boundary";
export function HoWorldActivationM1({canManage}:{canManage:boolean}){
 const preview=useMemo(()=>createWorldStagingBoundary(canManage),[canManage]);
 return <><p role="status">M1 · Mô phỏng kích hoạt World, không lưu vào hệ thống.</p><TddPreferencePolicy.Provider value="ephemeral"><HoWorldCatalog canManage={canManage} preview={preview}/></TddPreferencePolicy.Provider></>;
}
