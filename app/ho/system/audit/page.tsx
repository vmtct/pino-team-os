import { HoWorkspace } from "@/app/ho/HoWorkspace";
import { HoAccessAudit } from "./HoAccessAudit";
export default function Page() { return <HoWorkspace module="audits" content={<HoAccessAudit/>}/>; }
