import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

test("PAP-2058 rejection CTA is outside the noninteractive status region and preserves its ACL guard",()=>{
  const source=readFileSync(new URL("../app/components/tos-vnext/ClassroomV4Presentation.tsx",import.meta.url),"utf8");
  const start=source.indexOf("{rejected&&<div className={styles.classRejected}");
  assert.ok(start>=0);
  const warning=source.slice(start,source.indexOf("</article>",start));
  assert.match(warning,/<div\b[^>]*className=\{styles\.classRejected\}[^>]*>\s*<div role="status" aria-label=\{"Cần bổ sung ảnh setup - "\+c\.name\}>/);
  assert.match(warning,/<\/p><\/div><button disabled=\{readOnly\|\|!o\?\.canAppend\} onClick=\{\(\)=>showProof\(c\.id,true\)\}>Bổ sung ảnh/);
  assert.doesNotMatch(warning,/<div className=\{styles\.classRejected\}[^>]*role="status"/);
});
