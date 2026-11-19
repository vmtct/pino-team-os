import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {test} from "node:test";

const source=(file:string)=>readFileSync(new URL(file,import.meta.url),"utf8");
const policy=source("./HoWishPolicyDetail.tsx");
const banner=source("../wish-banners/HoWishBannerDetail.tsx");
const css=source("./wish-detail-actions.module.css");

test("PAP-2030 Wish details consume canonical DSA property group geometry",()=>{
 for(const detail of [policy,banner]){
  assert.match(detail,/className="dsa-detail-group-container"/);
  assert.match(detail,/className="dsa-detail-group-grid" data-dsa-detail-group-grid="" data-wish-detail-groups/);
  assert.match(detail,/className="v24-prop-section" data-tdd-properties="detail"/);
  assert.match(detail,/className="v24-prop-grid"/);
  assert.doesNotMatch(detail,/wishActions\.(groups|propertyColumn|layout)\b/);
 }
 assert.doesNotMatch(css,/\.(groups|propertyColumn|layout)\s*\{/);
});
test("PAP-2030 policy curve remains a business section, not a property group",()=>{
 assert.match(policy,/<section className=\{"v24-prop-section "\+wishActions\.curve\} aria-label="Soft pity curve">/);
 assert.match(policy,/className=\{wishActions\.curveTable\}/);
});
