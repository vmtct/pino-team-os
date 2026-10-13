#!/usr/bin/env node
import fs from 'node:fs';
import { sendFc } from './fc-tool-core.mjs';
const args=process.argv.slice(2); const value=name=>{const i=args.indexOf(name);if(i<0||i===args.length-1)throw new Error(`ARG_REQUIRED:${name}`);return args[i+1]};
const text=fs.readFileSync(value('--text-file'),'utf8').replace(/^\uFEFF/,'');
sendFc(value('--slot'),text,{operationId:value('--operation')}).then(x=>console.log(JSON.stringify(x,null,2))).catch(e=>{console.error('ERROR: '+e.message);process.exitCode=1});
