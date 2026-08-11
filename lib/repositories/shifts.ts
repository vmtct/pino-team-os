import { notion,dbId } from "@/lib/notion";
import { mapShift,Shift } from "@/lib/domain/shift";
export async function listShifts():Promise<Shift[]>{const response=await notion().dataSources.query({data_source_id:dbId("NOTION_SHIFT_MASTER_DB_ID"),page_size:100});return response.results.map(mapShift);}
