/** PAP-1495 / PAP-1491 SPEC-UNLOCK S5: bounded DRAFT metadata fields. */
import {BoApiError} from "./bo-api-error";
import type {SpecialtyV2Detail,SpecialtyV2Summary} from "./ho-specialty-v2-reader";
export type SpecialtyMetadataField="name"|"description";
export type SpecialtyMetadataPatch={expectedVersion:number;name:string}|{expectedVersion:number;description:string|null};
export function foldSpecialtyName(value:string):string{
 return value.normalize("NFD").replace(/\p{M}/gu,"").replace(/[đĐ]/g,"d")
  .toLocaleLowerCase("vi").trim().replace(/\s+/g," ");
}
export function planSpecialtyMetadataEdit(
 detail:SpecialtyV2Detail,catalog:readonly SpecialtyV2Summary[],field:SpecialtyMetadataField,value:unknown,
):SpecialtyMetadataPatch{
 if(detail.status!=="DRAFT")throw new BoApiError(409,"Chỉ có thể sửa Chuyên đề bản nháp.",null);
 if(typeof value!=="string")throw new BoApiError(400,"Giá trị chỉnh sửa không hợp lệ.",null);
 if(field==="name"){
  const name=value.trim();
  if(name.length<3||name.length>160)
   throw new BoApiError(400,"Tên Chuyên đề phải dài từ 3 đến 160 ký tự.",null);
  const key=foldSpecialtyName(name);
  if(catalog.some(item=>item.id!==detail.id&&item.pathProgramId===detail.pathProgramId&&foldSpecialtyName(item.name)===key))
   throw new BoApiError(409,"Tên Chuyên đề đã tồn tại trong Path này.",null);
  return {expectedVersion:detail.version,name};
 }
 if(value.length>4000)throw new BoApiError(400,"Mô tả không được vượt quá 4.000 ký tự.",null);
 return {expectedVersion:detail.version,description:value.trim()||null};
}
