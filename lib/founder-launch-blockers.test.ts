import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {recurrenceWeekdaysFromForm,syllabusMediaIds,weekdayLabels,withUploadedMedia,type Syllabus} from "./founder-model";

const syllabus:Syllabus={id:"syllabus",pathProgramId:"path",curriculumWeek:1,title:"Lesson",shortDescription:null,publicDescription:null,skillSummary:null,keywords:null,ageMin:null,ageMax:null,thumbnailMediaAssetId:"saved-thumbnail",coverMediaAssetId:null,thumbnailUrl:"https://assets.pinohouse.art/saved.jpg",coverUrl:null,publicationStatus:"draft"};

test("weekday array renders compact labels and serializes the multi-select",()=>{const form=new FormData();form.append("weekdays","1");form.append("weekdays","3");assert.deepEqual(recurrenceWeekdaysFromForm(form),[1,3]);assert.equal(weekdayLabels([3,1]),"T2 · T4")});
test("successful upload stays in draft state and save serializes canonical media IDs",()=>{const media=withUploadedMedia({},"thumbnail",{id:"uploaded-thumbnail",url:"https://assets.pinohouse.art/uploaded.jpg"});assert.equal(media.thumbnail?.url,"https://assets.pinohouse.art/uploaded.jpg");assert.deepEqual(syllabusMediaIds(syllabus,media),{thumbnailMediaAssetId:"uploaded-thumbnail",coverMediaAssetId:null})});
test("reopening keeps the canonical saved image projection",()=>{assert.equal(syllabus.thumbnailUrl,"https://assets.pinohouse.art/saved.jpg");assert.deepEqual(syllabusMediaIds(syllabus,{}),{thumbnailMediaAssetId:"saved-thumbnail",coverMediaAssetId:null})});
test("upload control cannot submit or invoke the workspace-reloading mutation",()=>{const source=readFileSync(new URL("../app/founder/workspace.tsx",import.meta.url),"utf8");assert.match(source,/button type="button" className="button secondary"/);assert.doesNotMatch(source,/mutate\("thumbnail"/);assert.match(source,/onFile=\{f=>void upload\(f,"thumbnail"\)\}/)});
