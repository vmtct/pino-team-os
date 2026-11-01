#!/usr/bin/env node
/**
 * PAP-1073 G3: compare new deterministic fixture PNGs to Founder-approved
 * golden run #40811677302. No live/Production credentials or screenshot edits.
 * Large visible changes require explicit new Founder approval, not auto-update.
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve, join } from "node:path";
import { createHash } from "node:crypto";
import sharp from "sharp";
import { approvedSuccessorImages } from "../lib/tdd-g3-golden-successor.mjs";
import { comparePixelBuffers } from "../lib/tdd-g3-visual-pixels.mjs";

const root=resolve("docs/visual-goldens/pap1073");
const golden=join(root,"run-40811677302");
const actual=resolve("artifacts/pap1073-g3");
const manifest=JSON.parse(readFileSync(join(root,"manifest.json"),"utf8"));
const sha256=x=>createHash("sha256").update(x).digest("hex");
const errors=[];
const results=[];
const ratioLimit=0.01;
const approvedSuccessorRuns=[41071808375,41253524859];
const successors=new Map();
for(const run of approvedSuccessorRuns) {
  const successorRoot=join(root,"successor-"+run);
  try {
    const images=approvedSuccessorImages(
      JSON.parse(readFileSync(join(successorRoot,"manifest.json"),"utf8")),
      path=>readFileSync(join(successorRoot,...path.split("/"))));
    for(const [path,data] of images) {
      if(successors.has(path)) throw new Error("Duplicate approved G3 successor image");
      successors.set(path,data);
    }
  } catch(error) {
    errors.push("G3 approved successor validation failed: "+(error instanceof Error?error.message:"unknown"));
  }
}
const identityOk=manifest.schemaVersion===1 &&
  manifest.sourceRun===40811677302 &&
  manifest.sourceSha==="aa0d5fd88ad09de25c14cc154a68fbf95d2d8f49" &&
  manifest.artifactId===12870189049 && manifest.images===30 && manifest.geometryReports===10;
if(!identityOk)errors.push("Unapproved G3 manifest identity");
if(manifest.files?.length!==40 || new Set(manifest.files?.map(f=>f.path)).size!==40) {
  errors.push("G3 manifest must pin exactly 40 distinct files");
}
const expected=new Set();
for(const surface of ["bo","ho"])for(const width of [1440,1024,768,390,320]){
  expected.add(surface+"/"+width+"/geometry.json");
  for(const stage of ["table","drawer","detail"])expected.add(surface+"/"+width+"/"+stage+".png");
}
for(const file of manifest.files??[]){
  if(!expected.has(file.path)) {errors.push("Unexpected golden asset "+file.path);continue;}
  const parts=file.path.split("/");
  const source=join(golden,...parts);
  if(!existsSync(source)) {errors.push("Golden file missing "+file.path);continue;}
  const data=readFileSync(source);
  if(sha256(data)!==file.sha256 || data.length!==file.bytes)errors.push("Golden was modified "+file.path);
}
for(const path of expected){
  const parts=path.split("/");
  const image=join(actual,...parts);
  if(!existsSync(image)) {errors.push("Current G3 artifact missing "+path);continue;}
  if(!path.endsWith(".png")) continue;
  const reference=successors.get(path)??join(golden,...parts);
  try{
    const base=await sharp(reference).ensureAlpha().raw().toBuffer({resolveWithObject:true});
    const newest=await sharp(image).ensureAlpha().raw().toBuffer({resolveWithObject:true});
    if(base.info.width!==newest.info.width || base.info.height!==newest.info.height){
      errors.push("Golden screenshot dimensions changed "+path);
      continue;
    }
    const compare=comparePixelBuffers(base.data,newest.data);
    const ratio=Number(compare.ratio.toFixed(5));
    results.push({path,ratio,changed:compare.changed,total:compare.total});
    if(compare.ratio>ratioLimit)errors.push("Visual drift exceeds 1% visible pixels "+path+" ratio="+ratio);
  }catch(error){
    errors.push("Unable to compare screenshot "+path+" "+(error instanceof Error?error.name:"unknown"));
  }
}
const conclusion={name:"PAP-1073 Founder-approved G3 visual diff",approvedRun:40811677302,
  approvedSuccessorRun:41071808375,approvedSuccessorRuns,successorImages:successors.size,
  compared:results.length,expected:30,limit:ratioLimit,maxRatio:results.length?Math.max(...results.map(r=>r.ratio)):null,
  failed:errors.length,errors:errors.slice(0,35),highestDrift:results.sort((a,b)=>b.ratio-a.ratio).slice(0,8)};
if(errors.length){console.error(JSON.stringify(conclusion,null,2));process.exitCode=1}
else console.log(JSON.stringify(conclusion,null,2));
