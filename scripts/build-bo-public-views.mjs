// Compile the existing BO Views state/client/queue for the standalone canonical workspace.
// esbuild is already supplied by the locked tsx/OpenNext build toolchain.
import {build} from 'esbuild';
await build({entryPoints:['lib/bo-prototype-view-bridge.ts'],bundle:true,format:'iife',globalName:'window.PinoBOViews',target:'es2022',minify:true,outfile:'public/bo-ui-replica/bo-public-views.js'});
