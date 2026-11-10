// PAP-1805 · Return to two-app homepage by Founder direction; keep one shared inside shell.
import type {Metadata} from "next";
import {SpaceLauncher} from "./SpaceLauncher";
export const metadata:Metadata={title:"Piner Space · PINO House & MyTime",description:"Hai không gian sáng tạo chung trải nghiệm PINO."};
export default function PinerHomePage(){return <SpaceLauncher/>;}
