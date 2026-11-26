/** PAP-1043 / PAP-2225 — preserve sync preview while fencing async native commands. */
export function runRunningClassControl(lock:{current:boolean},busy:(value:boolean)=>void,command:()=>void|Promise<void>,settled:(error:unknown|null)=>void):boolean{
 if(lock.current)return false;
 lock.current=true;busy(true);
 const finish=(error:unknown|null)=>{lock.current=false;busy(false);settled(error);};
 try{
  const result=command();
  if(result&&typeof result.then==="function")void Promise.resolve(result).then(()=>finish(null),error=>finish(error??Error("Không thể lưu Running Class.")));
  else finish(null);
 }catch(error){finish(error??Error("Không thể lưu Running Class."));}
 return true;
}
