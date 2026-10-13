#!/usr/bin/env node
import {claimReview,inspectReview,consumeReview} from './review-tool-state.mjs';

const args=process.argv.slice(2),cmd=args.shift();
const value=name=>{const i=args.indexOf(name);if(i<0||i===args.length-1)throw new Error('ARG_REQUIRED:'+name);return args[i+1]};
const flag=name=>args.includes(name);
const binding=()=>({reviewKind:value('--review-kind'),repository:value('--repository'),prNumber:Number(value('--pr')),candidate:value('--candidate')});
let out;
switch(cmd){
  case 'claim': out=claimReview(binding(),value('--provider'),{reclaimNoSideEffect:flag('--reclaim-no-side-effect')});break;
  case 'inspect': out=inspectReview(value('--key'));break;
  case 'consume': out=consumeReview(value('--key'),value('--provider'));break;
  default: throw new Error('USAGE: review-claim-tool.mjs claim|inspect|consume ...');
}
console.log(JSON.stringify(out,null,2));
