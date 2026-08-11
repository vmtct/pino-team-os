import { notion,dbId } from "@/lib/notion";
import { mapStaff,Staff } from "@/lib/domain/staff";
export async function listStaff():Promise<Staff[]>{const response=await notion().dataSources.query({data_source_id:dbId("NOTION_STAFF_DB_ID"),page_size:100});return response.results.map(mapStaff);}
