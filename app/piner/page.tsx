// PAP-1805 · Return to two-app homepage by Founder direction; keep one shared inside shell.
import type {Metadata} from "next";
import {SpaceLauncher} from "./SpaceLauncher";
export const metadata:Metadata={title:"Piner APP · PINO Afterschool & MyTime by PINO",description:"PINO Afterschool — Hết giờ học, đến giờ con khám phá. MyTime by PINO — Hết những bận rộn, đến giờ mình tận hưởng."};
export default function PinerHomePage(){return <SpaceLauncher/>;}
