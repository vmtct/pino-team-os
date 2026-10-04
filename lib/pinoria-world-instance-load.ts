export function shouldApplyInstanceLoad(token:number,currentToken:number,selectedStudentId:string|null,requestedStudentId:string):boolean {
  return token===currentToken && selectedStudentId===requestedStudentId;
}

export function instanceBelongsToSelectedLearner(instanceStudentProfileId:string|null,selectedStudentId:string|null):boolean {
  return Boolean(instanceStudentProfileId && selectedStudentId && instanceStudentProfileId===selectedStudentId);
}
