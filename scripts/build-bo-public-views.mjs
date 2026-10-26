import './build-bo-authority.mjs';
// Compile the existing BO Views state/client/queue for the standalone canonical workspace.
// esbuild is already supplied by the locked tsx/OpenNext build toolchain.
import {build} from 'esbuild';
import {copyFile} from 'node:fs/promises';
// Preserve the existing legacy bytes on other surfaces; /bo loads only its six authority CSS.
await Promise.all([copyFile('app/globals.css','public/team-legacy-global.css'),copyFile('app/bo/design-system/foundation.css','public/bo-legacy-foundation.css')]);
await build({entryPoints:['lib/bo-prototype-view-bridge.ts'],bundle:true,format:'iife',globalName:'window.PinoBOViews',target:'es2022',minify:true,outfile:'public/bo-ui-replica/bo-public-views.js'});
