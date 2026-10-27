import { redirect } from "next/navigation";
import { HO_HOME_PATH } from "@/lib/ho-routes";
export default function HoHome() { redirect(HO_HOME_PATH); }
