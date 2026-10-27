"use client";
import {BoWorkforceRoute} from "@/app/bo/architecture/BoWorkforceRoute";
import {moduleAdapter} from "./adapter";
export default function PayrollPeriodCanonicalPage(){
 return <BoWorkforceRoute moduleKey="payroll-periods" adapter={moduleAdapter}/>;
}
