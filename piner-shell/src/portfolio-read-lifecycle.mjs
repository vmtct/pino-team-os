// PAP-2432: unmounted presentation lifecycle. Server still authorizes every read.
// The injected read port must return only an admitted, scoped presentation model.
const canonical=v=>typeof v==="string"&&/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(v);
const states=new Set(["ready","empty","no-profile","denied","error"]);
export function createPortfolioReadLifecycle({space,authorizedStudents,read,render}){
 if(!["house","mytime"].includes(space)||typeof authorizedStudents!=="function"||typeof read!=="function"||typeof render!=="function")throw new TypeError("Invalid portfolio lifecycle");
 let generation=0,active=null,selection=null,closed=false;
 const show=(state,profileKey=null)=>render({space,state,profileKey,posts:[]});
 function cancel(){generation++;active?.abort();active=null;}
 function allowed(id){
  if(space==="mytime")return id===null;
  const ids=authorizedStudents();
  return canonical(id)&&Array.isArray(ids)&&ids.includes(id);
 }
 async function select(id){
  if(closed)return;
  cancel();selection=null;
  if(!allowed(id)){show(space==="house"?"no-profile":"denied");return;}
  selection={id};const current=selection;
  const ticket=generation,controller=new AbortController();active=controller;
  show("loading",id);
  try{
   const model=await read({space,studentId:id,signal:controller.signal});
   if(closed||ticket!==generation||selection!==current||controller.signal.aborted)return;
   if(!allowed(id)){selection=null;show("denied");return;}
   if(!model||model.space!==space||model.profileKey!==id||!states.has(model.state)||!Array.isArray(model.posts)){show("error",id);return;}
   if(model.state==="ready"&&model.posts.length>0&&model.posts.every(p=>p.space===space))render(model);
   else if(model.state==="ready")show("error",id);
   else show(model.state,id);
  }catch{
   if(!closed&&ticket===generation&&selection===current&&!controller.signal.aborted)show("error",id);
  }finally{if(active===controller)active=null;}
 }
 function retry(){if(!closed&&selection)return select(selection.id);}
 function invalidate(){if(closed)return;closed=true;cancel();selection=null;show("denied");}
 return Object.freeze({select,retry,invalidate});
}
