// PAP-1775 · PNR-APP-HUB: open directly in one unified Bảng tin after login.
import type { Metadata } from "next";
import { PinerUnified } from "./UnifiedSpace";
export const metadata:Metadata={
 title:"Piner Space · Bảng tin",
 description:"Nhật ký sáng tạo Hội Họa và Piano trong một không gian PINO."
};
export default function PinerHomePage(){return <PinerUnified tab="home"/>;}
