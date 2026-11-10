// PAP-1805 · Return to two-app homepage by Founder direction; keep one shared inside shell.
import type {Metadata} from "next";
import {SpaceLauncher} from "./SpaceLauncher";
export const metadata:Metadata={title:"Piner APP · PINO Journey & MyTime by PINO",description:"PINO Journey và MyTime by PINO — hai hành trình sáng tạo trong Piner APP."};
export default function PinerHomePage(){return <SpaceLauncher/>;}
