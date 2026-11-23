import { LeadDetailPage } from "../../LeadDetailPage";
import { requireLeadPreviewAccess } from "../access";
export const dynamic="force-dynamic";
export default async function LeadsM1StagingDetail({params}:{params:Promise<{leadId:string}>}){await requireLeadPreviewAccess();const {leadId}=await params;return <LeadDetailPage leadId={leadId} preview />;}
