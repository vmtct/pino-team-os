/** PAP-942/943 read presentation only. No fabricated node, guest, device or TV state. */
export type ArrivalStatus="EXPECTED"|"ARRIVED"|"LEFT";
export type OpsGuest={id:string;name:string;initials:string;className:string;classTime:string;room:string;guardian:string};
export type OpsEvent={id:string;time:string;text:string};
export type OpsReadModel={loaded:boolean;guests:OpsGuest[];assetNames:string[];channels:string[];outfits:string[];attendance:Record<string,ArrivalStatus>;wishes:Record<string,boolean>;events:OpsEvent[];tvPlaying:boolean|null;tvChannel:string|null;equipment:Record<string,string>;wardrobe:Record<string,string>};
export function unavailableOpsReadModel():OpsReadModel{return {loaded:false,guests:[],assetNames:[],channels:[],outfits:[],attendance:{},wishes:{},events:[],tvPlaying:null,tvChannel:null,equipment:{},wardrobe:{}}}
