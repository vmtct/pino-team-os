#!/usr/bin/env node
import fs from 'node:fs';
import { applyFcAuthority } from './fc-tool-core.mjs';
const args=process.argv.slice(2); const value=name=>{const i=args.indexOf(name);if(i<0||i===args.length-1)throw new Error(`ARG_REQUIRED:${name}`);return args[i+1]}; const optional=name=>{const i=args.indexOf(name);return i<0?null:args[i+1]};
const desired=JSON.parse(fs.readFileSync(value('--desired-file'),'utf8').replace(/^\uFEFF/,'')); const expectedFile=optional('--expected-file'); const expected=expectedFile?JSON.parse(fs.readFileSync(expectedFile,'utf8').replace(/^\uFEFF/,'')):{};
applyFcAuthority(value('--slot'),{expected,desired}).then(x=>console.log(JSON.stringify(x,null,2))).catch(e=>{console.error('ERROR: '+e.message);process.exitCode=1});
