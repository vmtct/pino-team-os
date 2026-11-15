"use client";
import {BoWorkforceRoute} from "@/app/bo/architecture/BoWorkforceRoute";
import {useBoStagingUser} from "@/app/bo/components/registration/BoRuntimeBoundary";
import BoNativePayrollPeriods from "./BoNativePayrollPeriods";
import {moduleAdapter} from "./adapter";

/** PAP-1985 / PAP-1970: existing admitted page; only authenticated BO Staging
 * mounts the native view. Keep the existing Production route behavior unchanged.
 * No new host ingress or shared-keeper mutation. */
export default function PayrollPeriodCanonicalPage(){
 const stagingUser=useBoStagingUser();
 return stagingUser ? <BoNativePayrollPeriods/> : <BoWorkforceRoute moduleKey="payroll-periods" adapter={moduleAdapter}/>;
}
