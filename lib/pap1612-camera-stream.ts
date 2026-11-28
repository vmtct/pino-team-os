export type CameraStream = { getTracks(): readonly {stop(): void}[] };
/** A cancelled or superseded acquisition must never retain a camera stream. */
export function createCameraStreamLease<T extends CameraStream>() {
 let epoch=0,active:T|null=null;
 function release(){epoch++;const previous=active;active=null;previous?.getTracks().forEach(track=>track.stop());}
 function begin(){release();return epoch;}
 function isCurrent(token:number){return token===epoch;}
 function accept(token:number,stream:T){if(!isCurrent(token)){stream.getTracks().forEach(track=>track.stop());return false;}active=stream;return true;}
 return {begin,release,isCurrent,accept};
}
