/** PAP-1695 / PAP-1491 SPEC-UNLOCK — advisory UI readiness only.
 * Actual Mission ACTIVE/READY, Path status and prerequisite DAG are rechecked atomically by Core.
 */
import type {SpecialtyV2Detail,SpecialtyV2Summary} from './ho-specialty-v2-reader';
export function specialtyPublishWarnings(s:SpecialtyV2Detail,catalog:readonly SpecialtyV2Summary[]):string[]{
 const warnings:string[]=[];
 if(s.status!=='DRAFT')warnings.push('Chỉ bản nháp mới được xuất bản.');
 if(s.name.trim().length<3)warnings.push('Tên chuyên đề cần ít nhất 3 ký tự.');
 if(!s.levels.length||s.levels.length>12)warnings.push('Chuyên đề cần từ 1 đến 12 cấp.');
 const levels=[...s.levels].sort((a,b)=>a.order-b.order),names=new Set<string>(),linked=new Set<string>();
 for(const [index,level] of levels.entries()){
  const name=level.name.normalize('NFD').toLocaleLowerCase('vi').trim();
  if(!name||names.has(name)||level.order!==index+1)warnings.push('Tên hoặc thứ tự cấp không hợp lệ.');
  names.add(name);
  if(!level.missionIds.length)warnings.push(level.name+': chưa liên kết nhiệm vụ.');
  for(const id of level.missionIds){
   if(linked.has(id))warnings.push('Nhiệm vụ liên kết trùng giữa các cấp.');
   linked.add(id);
  }
 }
 if(linked.size!==s.missionCountDistinct)warnings.push('Số nhiệm vụ chưa được xác minh.');
 const seen=new Set<string>();
 for(const id of s.prerequisiteIds){
  if(seen.has(id)||id===s.id)warnings.push('Tiên quyết bị trùng hoặc tự tham chiếu.');
  seen.add(id);
  const prerequisite=catalog.find(c=>c.id===id);
  if(!prerequisite||prerequisite.status!=='ACTIVE'||prerequisite.pathProgramId!==s.pathProgramId)
   warnings.push('Tiên quyết phải đang áp dụng và cùng Path.');
 }
 return [...new Set(warnings)];
}
