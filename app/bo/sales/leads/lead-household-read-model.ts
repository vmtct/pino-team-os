/** PAP-2288 / PLT-LEAD: isolated read state for the approved Lead TDD shell. */
import type { LeadDetail, LeadIntent, LeadPage, LeadRow, LeadSearch } from "@/lib/bo-lead-household-client";
import { LeadApiError } from "@/lib/bo-lead-household-client";
import type { LeadHouseholdApi } from "./lead-household-provider";

type ReadApi = Pick<LeadHouseholdApi, "search" | "detail" | "history">;
type Phase = "idle" | "loading" | "ready" | "empty" | "error";
type ReadError = { status: number | null; code: string };
type PageState<T> = { phase: Phase; items: T[]; nextCursor: string | null; error: ReadError | null };
type DetailState = { phase: Phase; id: string | null; record: LeadDetail | null; error: ReadError | null };
const emptyPage = <T>(): PageState<T> => ({phase:"idle",items:[],nextCursor:null,error:null});
const emptyDetail = (): DetailState => ({phase:"idle",id:null,record:null,error:null});
function errorState(error: unknown): ReadError {
  return error instanceof LeadApiError ? {status:error.status,code:error.code} : {status:null,code:"LEAD_READ_FAILED"};
}
function pageError(): never { throw new LeadApiError(502,"LEAD_PAGE_INVALID",null); }
function mergePage<T extends {id:string}>(previous:T[], page:LeadPage<T>, cursors:Set<string>): PageState<T> {
  if (page.hasMore !== Boolean(page.nextCursor) || (page.nextCursor && cursors.has(page.nextCursor))) pageError();
  const items = new Map(previous.map(item=>[item.id,item]));
  for (const item of page.items) {
    if (!item.id) pageError();
    items.set(item.id,item);
  }
  if (page.nextCursor) cursors.add(page.nextCursor);
  return {phase:items.size?"ready":"empty",items:[...items.values()],nextCursor:page.nextCursor,error:null};
}

/** No fallback, cache across identities, automatic retry or transport creation. */
export class LeadReadModel {
  directory: PageState<LeadRow> = emptyPage();
  selected: DetailState = emptyDetail();
  history: PageState<LeadIntent> = emptyPage();
  private searchInput: LeadSearch = {};
  private directoryCursors = new Set<string>();
  private historyCursors = new Set<string>();
  private directoryRequest: AbortController | null = null;
  private detailRequest: AbortController | null = null;
  private historyRequest: AbortController | null = null;
  constructor(private readonly api: ReadApi, private readonly changed: () => void = () => {}) {}
  async search(input: Omit<LeadSearch,"cursor">) {
    this.searchInput=structuredClone(input);
    this.directoryCursors.clear();
    this.directoryRequest?.abort();
    this.directory=emptyPage();
    await this.loadDirectory(null);
  }
  async nextDirectory() {
    if (this.directory.phase!=="loading" && this.directory.nextCursor) await this.loadDirectory(this.directory.nextCursor);
  }
  private async loadDirectory(cursor:string|null) {
    const request=new AbortController();
    this.directoryRequest?.abort();this.directoryRequest=request;
    const previous=cursor?this.directory.items:[];
    this.directory={...this.directory,phase:"loading",error:null};this.changed();
    try {
      const page=await this.api.search({...this.searchInput,...(cursor?{cursor}:{})},request.signal);
      if (this.directoryRequest!==request || request.signal.aborted) return;
      this.directory=mergePage(previous,page,this.directoryCursors);
    } catch(error) {
      if (this.directoryRequest!==request || request.signal.aborted) return;
      this.directory={phase:"error",items:[],nextCursor:null,error:errorState(error)};
    }
    this.changed();
  }
  async select(id:string|null) {
    this.detailRequest?.abort();this.historyRequest?.abort();
    this.detailRequest=null;this.historyRequest=null;
    this.historyCursors.clear();this.history=emptyPage();
    this.selected={...emptyDetail(),id};this.changed();
    if (!id) return;
    const request=new AbortController();this.detailRequest=request;
    this.selected={phase:"loading",id,record:null,error:null};this.changed();
    try {
      const record=await this.api.detail(id,request.signal);
      if (this.detailRequest!==request || request.signal.aborted) return;
      if(record.id!==id) throw new LeadApiError(502,"LEAD_READBACK_MISMATCH",null);
      this.selected={phase:"ready",id,record,error:null};
    } catch(error) {
      if (this.detailRequest!==request || request.signal.aborted) return;
      this.selected={phase:"error",id,record:null,error:errorState(error)};
    }
    this.changed();
  }
  async openHistory() {
    if(this.selected.phase!=="ready" || !this.selected.id) return;
    this.historyRequest?.abort();this.historyCursors.clear();this.history=emptyPage();
    await this.loadHistory(this.selected.id,null);
  }
  async nextHistory() {
    if(this.selected.phase==="ready" && this.selected.id && this.history.phase!=="loading" && this.history.nextCursor)
      await this.loadHistory(this.selected.id,this.history.nextCursor);
  }
  private async loadHistory(id:string,cursor:string|null) {
    const request=new AbortController();this.historyRequest?.abort();this.historyRequest=request;
    const previous=cursor?this.history.items:[];
    this.history={...this.history,phase:"loading",error:null};this.changed();
    try {
      const page=await this.api.history(id,{limit:50,...(cursor?{cursor}:{})},request.signal);
      if(this.historyRequest!==request || request.signal.aborted || this.selected.id!==id) return;
      this.history=mergePage(previous,page,this.historyCursors);
    }catch(error){
      if(this.historyRequest!==request || request.signal.aborted || this.selected.id!==id) return;
      this.history={phase:"error",items:[],nextCursor:null,error:errorState(error)};
    }
    this.changed();
  }
  dispose(){
    this.directoryRequest?.abort();this.detailRequest?.abort();this.historyRequest?.abort();
    this.directoryRequest=null;this.detailRequest=null;this.historyRequest=null;
    this.directory=emptyPage();this.selected=emptyDetail();this.history=emptyPage();
    this.searchInput={};this.directoryCursors.clear();this.historyCursors.clear();
  }
}
