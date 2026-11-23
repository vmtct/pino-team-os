import { LeadHouseholdShell } from "../LeadHouseholdShell";
import { requireLeadPreviewAccess } from "./access";
export const dynamic="force-dynamic";
export default async function LeadsM1StagingPreview(){await requireLeadPreviewAccess();return <LeadHouseholdShell preview />;}
