// PAP-1526: no per-row requests; TDD local paging requires a complete collection.
import {BoApiError} from "./bo-api-error";
import {billTableCenter,billTableRoot,parseBillTablePage} from "./bo-bill-table-contract";
export async function loadBoBillTable(center:string,fetcher:typeof fetch,signal?:AbortSignal){
 const path=billTableRoot+"/center/"+center;
 if(billTableCenter(path)!==center)throw new BoApiError(400,"Chọn cơ sở hợp lệ.",null);
 signal?.throwIfAborted();
 const response=await fetcher(path+"?"+new URLSearchParams({centerId:center,limit:"100"}),{method:"GET",cache:"no-store",credentials:"same-origin",redirect:"error",signal});
 signal?.throwIfAborted();
 if(response.status!==200)throw new BoApiError(response.ok?502:response.status,"Không thể tải bảng Bill (HTTP "+response.status+").",null);
 const raw:unknown=await response.json();
 signal?.throwIfAborted();
 const page=parseBillTablePage((raw as {data?:unknown})?.data,center);
 if(page.hasMore)throw new BoApiError(409,"Cơ sở có hơn 100 Bills. Danh sách vượt giới hạn hiển thị; không thể tải đầy đủ.",null);
 return page.items;
}
