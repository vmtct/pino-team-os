"use client";
import styles from "./pinoria-world.module.css";
import {LayeredCharacter,pinoriaAssetUrl,type PinoriaCharacterConfig,type PinoriaWardRender} from "@/app/pinoria-tv/layered-character";
type Layer={id:string;kind:"MEDIA"|"CHARACTER";displayName:string;mediaType:string|null;assetKey?:string|null;positionX?:number;positionY?:number;scale?:number;zIndex?:number;anchor?:"CENTER"|"BOTTOM_CENTER";enabled:boolean};
type Scene={id:string;displayName:string;baseAssetKey:string;canvasWidth?:number;canvasHeight?:number;layers:Layer[]};
type Character={id:string;config:PinoriaCharacterConfig;wardRender:PinoriaWardRender|null}|null;
export function PinoriaInstancePreview({scene,accessible,unlocked,character}:{scene:Scene;accessible:boolean;unlocked:readonly string[];character?:Character}){
 if(!accessible)return <div role="status" aria-label="Scene locked">Scene locked</div>;
 const base=pinoriaAssetUrl(scene.baseAssetKey);
 return <div aria-label="Canonical Scene runtime preview" style={{position:"relative",width:"100%",overflow:"hidden",aspectRatio:`${scene.canvasWidth??1920} / ${scene.canvasHeight??1080}`,backgroundImage:base?`url(${base})`:undefined,backgroundSize:"cover",backgroundPosition:"center",backgroundColor:"#151e32"}}>
  {[...scene.layers].sort((a,b)=>(a.zIndex??0)-(b.zIndex??0)).map(layer=>{
   if(layer.kind==="MEDIA"&&(!layer.enabled||!unlocked.includes(layer.id)))return null;
   const asset=layer.kind==="MEDIA"?pinoriaAssetUrl(layer.assetKey??null):null;
   const placement={position:"absolute" as const,left:`${50+(layer.positionX??0)}%`,top:`${50+(layer.positionY??0)}%`,zIndex:layer.zIndex??1,transform:`translate(-50%,${layer.anchor==="BOTTOM_CENTER"?"-100%":"-50%"}) scale(${layer.scale??1})`};
   if(layer.kind==="CHARACTER")return <div key={layer.id} style={{...placement,width:"22%",height:"46%",transformOrigin:"50% 100%"}}>{character?<LayeredCharacter className={styles.worldCharacter} config={character.config} wardRender={character.wardRender}/>:<div role="status">Character unavailable</div>}</div>;
   if(!asset)return null;
   return <div key={layer.id} style={{...placement,width:"30%",height:"40%"}}>{layer.mediaType==="WEBM"?<video src={asset} autoPlay loop muted playsInline style={{position:"absolute",inset:0,width:"100%",height:"100%",objectFit:"contain"}}/>:<img src={asset} alt={layer.displayName} style={{position:"absolute",inset:0,width:"100%",height:"100%",objectFit:"contain"}}/>}</div>;
  })}
 </div>;
}
