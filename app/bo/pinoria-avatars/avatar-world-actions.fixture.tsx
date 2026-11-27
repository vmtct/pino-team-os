/** PAP-2153 synthetic interactive fixture: no live endpoints or stored browser state. */
import React,{useState} from "react";
import {createRoot} from "react-dom/client";
import {SelfWorldActions} from "./SelfWorldActions";
import {parseAvatarWorld,type WorldIntent} from "./avatar-world-contract";
const id=(n:number)=>"01a194f0-9bd0-7896-89a0-"+n.toString(16).padStart(12,"0");
const scope={selfId:id(1),centerId:id(2),studentProfileId:id(3)};
const grants=new Set(["pinoria.avatar.directory.view","pinoria.self.loadout.view","pinoria.world.avatar.view","pinoria.world.avatar.grant"]);
function Fixture(){
 const [version,setVersion]=useState(1),[deny,setDeny]=useState(false),[foreign,setForeign]=useState(false),[busy,setBusy]=useState(false);
 const [calls,setCalls]=useState<WorldIntent[]>([]);
 const state=parseAvatarWorld({...scope,capabilities:{grant:true,configure:true,setLive:true},grantableWorlds:[{id:id(4),displayName:"World QA",status:"ACTIVE",version,scenes:[]}],instances:[],loadout:{selfId:scope.selfId,version:0,ready:false}},scope);
 return <><button onClick={()=>setVersion(n=>n+1)}>Refresh fixture</button><button onClick={()=>setDeny(x=>!x)}>Toggle permission</button><button onClick={()=>setForeign(x=>!x)}>Toggle Center</button><button onClick={()=>setBusy(x=>!x)}>Toggle busy</button>
 <output data-testid="calls">{JSON.stringify(calls)}</output><SelfWorldActions scope={foreign?{...scope,centerId:id(9)}:scope} state={state} grants={deny?new Set<string>():grants} busy={busy} instanceId={null} onConfirm={i=>setCalls(c=>[...c,i])}/></>;
}
createRoot(document.getElementById("root")!).render(<Fixture/>);
