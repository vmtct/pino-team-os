/** PAP-1695 / PAP-1491 SPEC-UNLOCK — advisory readiness only; Core is authoritative. */
import type {SpecialtyV2Detail} from './ho-specialty-v2-reader';
export function specialtyPublishWarnings(s:SpecialtyV2Detail):string[]{
 const warnings:string[]=[];
 if(s.status!=='DRAFT')warnings.push('Chỉ bản nháp mới được xuất bản.');
 if(s.name.trim().length<3)warnings.push('Tên chuyên đề cần ít nhất 3 ký tự.');
 if(!s.levels.length||s.levels.length>12)warnings.push('Chuyên đề cần từ 1 đến 12 cấp.');
 const levels=[...s.levels].sort((a,b)=>a.order-b.order),names=new Set<string>(),linked=new Set<string>();
 for(const [index,level] of levels.entries()){
  const name=level.name.normalize('NFD').toLocaleLowerCase('vi').trim();
  if(!name||names.has(name)||level.order!==index+1)warnings.push('Tên hoặc thứ tự cấp không hợp lệ.');
  names.add(name);
  for(const id of level.missionIds){
   if(linked.has(id))warnings.push('Nhiệm vụ liên kết trùng giữa các cấp.');
   linked.add(id);
  }
 }
 if(linked.size!==s.missionCountDistinct)warnings.push('Số nhiệm vụ chưa được xác minh.');
 if(s.missionCountDistinct<1)warnings.push('Liên kết ít nhất một Nhiệm vụ trước khi xuất bản.');
 return [...new Set(warnings)];
}
