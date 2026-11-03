import {TddRegistry,type FieldSchema,type ModuleRow,type TableQuery} from '@/lib/workspace-schema';
import type {ApprovalVerifier} from '@/lib/workspace-schema/registry';
import type {SurfaceDefinition,SurfaceProvider} from '@/lib/workspace-adapters/contracts';
import {loadWeek,loadWeeks} from '@/lib/ho-termweek-client';
import {WEEK_PERMISSION,type HoWeek} from '@/lib/ho-termweek-contract';
import {BoApiError} from '@/lib/bo-api-error';
const permission=WEEK_PERMISSION;
const read={display:true,search:true,filter:true,sort:true,group:true,inlineEdit:false} as const;
export const termWeekFields=[
 {key:"name",label:"Tuần",type:"text",icon:"Aa",width:260,permission,readOnly:true,capabilities:read},
 {key:"code",label:"Mã tuần",type:"text",icon:"Aa",width:130,permission,readOnly:true,capabilities:read},
 {key:"ordinal",label:"Thứ tự",type:"number",icon:"#",width:100,permission,readOnly:true,capabilities:read},
 {key:"startDate",label:"Bắt đầu",type:"date",icon:"Aa",width:140,permission,readOnly:true,capabilities:read},
 {key:"endDate",label:"Kết thúc",type:"date",icon:"Aa",width:140,permission,readOnly:true,capabilities:read},
 {key:"rhythmKey",label:"Nhịp",type:"text",icon:"Aa",width:150,permission,readOnly:true,capabilities:read},
 {key:"termId",label:"Global Term",type:"text",icon:"Aa",width:240,permission,readOnly:true,capabilities:read},
 {key:"global_week_registration_locked",label:"Global Lock",type:"boolean",icon:"Aa",width:140,permission,readOnly:true,capabilities:read},
 {key:"referenceCount",label:"Tham chiếu",type:"number",icon:"#",width:120,permission,readOnly:true,capabilities:read},
 {key:"deletionEligible",label:"Có thể xóa",type:"boolean",icon:"Aa",width:120,permission,readOnly:true,capabilities:read},
] as const satisfies readonly FieldSchema[];
type F=typeof termWeekFields;
const keys=["name","code","ordinal","startDate","endDate","rhythmKey","termId","global_week_registration_locked","referenceCount","deletionEligible"] as const;
const sections=[{id:'term-week-info',label:'Thông tin Global TermWeek',fields:keys}] as const;
export const termWeekQuery:TableQuery<F>={search:'',filters:{logic:'AND',rules:[]},sort:{field:'startDate',direction:'desc'},group:null,order:keys,visible:['name','code','ordinal','startDate','endDate','rhythmKey','global_week_registration_locked','referenceCount'],page:1,pageSize:15};
export function termWeekInitialQuery(termId:string|null):TableQuery<F>{return termId&&/^[0-9a-f-]{36}$/.test(termId)?{...termWeekQuery,filters:{logic:'AND',rules:[{field:'termId',op:'eq',value:termId}]}}:termWeekQuery;}
export const termWeekDefinition={version:1,classification:'TDD_DEFAULT',surface:'HO',key:'termWeeks',label:'Global TermWeeks',group:'Operating Cycle',fields:termWeekFields,
 capabilities:{read:permission,create:permission,edit:permission,history:permission},
 actions:[
  {id:'week-create',label:'Tạo Global TermWeek',slot:'table.header',variant:'primary',capability:'create',handler:'week.create'},
  {id:'week-edit',label:'Chỉnh sửa',slot:'detail.header',variant:'secondary',capability:'edit',handler:'week.update'},
  {id:'week-delete',label:'Xóa',slot:'detail.header',variant:'danger',capability:'edit',handler:'week.delete'},
  {id:'week-lock',label:'Global Lock ON/OFF',slot:'detail.header',variant:'secondary',capability:'edit',handler:'week.lock'},
  {id:'week-parent',label:'Global Term',slot:'detail.header',variant:'tertiary',capability:'read',handler:'week.parent'},
  {id:'week-parent-drawer',label:'Global Term',slot:'drawer.header',variant:'tertiary',capability:'read',handler:'week.parent'},
 ],
 table:{identity:{field:'name',pinned:'left',hideable:false,reorderable:false},columns:keys.map(field=>({field,visible:termWeekQuery.visible.includes(field)})),
 search:{fields:['name','code','termId'],normalization:'vi-diacritic-insensitive'},filters:{fields:['name','termId','startDate','endDate','rhythmKey','global_week_registration_locked'],mode:'flat',logic:'AND'},sort:{fields:['name','code','ordinal','startDate','endDate','referenceCount'],mode:'single',nulls:'last',tieBreak:'record-id'},group:{fields:['termId','rhythmKey'],mode:'single'},views:{builtIn:[],saved:{kind:'local-ui'},actions:['add','apply','rename','delete','reorder']},pagination:{sizes:[8,15,30],defaultSize:15,mode:'local-ui'},inlineEdit:{fields:[],enabled:false},interaction:{settings:['properties','grouping','filters','quick-views'],quickView:'separate-opener',keyboard:'canonical',undo:'local-ui-only'}},
 drawer:{density:'one-column',sections,actions:[]},
 detail:{overview:{sections},businessTabs:[{id:'business',label:'Dữ liệu và Global Lock',kind:'field-group',source:{adapter:'ho-global-termweek-business',permission},sections:[{id:'week-business',label:'Dữ liệu nghiệp vụ',fields:['code','ordinal','startDate','endDate','rhythmKey','global_week_registration_locked','referenceCount','deletionEligible']}]}],history:{kind:'unavailable',reason:'Chưa tải được lịch sử từ Core.'}},
} as const satisfies SurfaceDefinition<F>;
const row=(w:HoWeek):ModuleRow<F>=>({...w});
export const termWeekProvider:SurfaceProvider<F>={pagination:'local-ui',
 async list(_query,scope,fetcher,signal){if(scope.surface!=='HO')throw Error('HO only');const weeks=await loadWeeks(fetcher,signal);return {records:weeks.map(w=>({row:row(w),version:w.updatedAt})),total:weeks.length};},
 async detail(id,scope,fetcher,signal){if(scope.surface!=='HO')throw Error('HO only');try{const w=await loadWeek(id,fetcher,signal);return {row:row(w),version:w.updatedAt};}catch(e){if(e instanceof BoApiError&&e.status===404)return null;throw e;}},
 history:{subjectType:'term_week',bind:(fetcher,scope)=>({kind:'provider',source:{adapter:'ho-global-termweek-audit',permission},async load(subject,_context,cursor,signal){if(scope.surface!=='HO'||subject.type!=='term_week')return {status:'denied'};if(cursor)return {status:'unavailable',reason:'Core chưa hỗ trợ phân trang audit.'};const week=await loadWeek(subject.id,fetcher,signal);return {status:'authorized',nextCursor:null,events:week.history.map(h=>({id:h.id,at:h.occurredAt,actor:h.actorId??'Core',action:h.action,outcome:'succeeded',source:'Core Operating Cycle',subject,redacted:true,changes:h.changes}))};}})},
};
export const verifyGlobalWeekExtensionApproval:ApprovalVerifier=()=>false;
export const termWeekRegistry=new TddRegistry(verifyGlobalWeekExtensionApproval);
export const termWeekSchema=termWeekRegistry.register({...termWeekDefinition,data:{id:'ho-global-termweeks-read',async list(_query:TableQuery<F>,_context,signal){const weeks=await loadWeeks(fetch,signal);return {rows:weeks.map(row),total:weeks.length};},async detail(id:string,_context,signal){return row(await loadWeek(id,fetch,signal));}}});
