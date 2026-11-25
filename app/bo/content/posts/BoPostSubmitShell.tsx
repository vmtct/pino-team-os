"use client";
/** PAP-2337 / PNR-APP-HUB — same native BO product UI, fixture session only. */
import {useEffect,useState} from "react";
import {BoPostsDraftRuntime} from "@/app/bo/piner-posts/BoPostsDraftRuntime";
import {createPostPreviewSession} from "@/app/bo/piner-posts/post-preview-session";
import {postPreviewNavigation} from "@/app/bo/piner-posts/post-preview-navigation";
import {TddPreferencePolicy} from "@/app/components/workspace-renderer/Record";
export function BoPostSubmitShell(){
 const [preview,setPreview]=useState<{session:ReturnType<typeof createPostPreviewSession>;navigation:ReturnType<typeof postPreviewNavigation>}|null>(null);
 useEffect(()=>{
  const local=location.origin==="http://192.168.1.6:8800"&&self.origin==="null";
  const staging=location.origin==="https://bo.staging.pinohouse.art";
  if((!local&&!staging)||location.pathname!=="/bo/piner-posts")return;
  const session=createPostPreviewSession();const navigation=postPreviewNavigation();setPreview({session,navigation});return()=>session.dispose();
 },[]);
 return preview?<TddPreferencePolicy.Provider value="ephemeral"><BoPostsDraftRuntime session={preview.session} centerLabel="PINO Cần Thơ (mẫu)" previewNavigation={preview.navigation}/></TddPreferencePolicy.Provider>:null;
}
