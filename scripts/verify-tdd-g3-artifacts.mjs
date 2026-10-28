#!/usr/bin/env node
/** PAP-1073: fail CI if a green geometry run silently lost its visual evidence. */
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { resolve, join } from "node:path";
const root = resolve("artifacts/pap1073-g3");
const surfaces = ["bo", "ho"];
const widths = [1440, 1024, 768, 390, 320];
const stages = ["table", "drawer", "detail"];
let images = 0;
let reports = 0;
const errors = [];
for (const surface of surfaces) {
  for (const width of widths) {
    const dir = join(root, surface, String(width));
    if (!existsSync(dir)) {
      errors.push(`Missing evidence directory: ${dir}`);
      continue;
    }
    const expected = ["geometry.json", ...stages.map(s => `${s}.png`)];
    const files = readdirSync(dir);
    for (const file of expected) if (!files.includes(file)) errors.push(`Missing: ${join(dir, file)}`);
    for (const file of files) if (!expected.includes(file)) errors.push(`Unexpected: ${join(dir, file)}`);
    for (const stage of stages) {
      const file = join(dir, `${stage}.png`);
      if (!existsSync(file)) continue;
      const size = statSync(file).size;
      const png = readFileSync(file);
      if (size < 1024 || !png.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) {
        errors.push(`Invalid PNG ${file} (${size} bytes)`);
      } else images++;
    }
    const metricsPath = join(dir, "geometry.json");
    if (!existsSync(metricsPath)) continue;
    let metrics;
    try { metrics = JSON.parse(readFileSync(metricsPath, "utf8")); }
    catch { errors.push(`Malformed JSON: ${metricsPath}`); continue; }
    if (metrics.surface?.toLowerCase() !== surface || metrics.width !== width) {
      errors.push(`Wrong surface/width: ${metricsPath}`);
    }
    for (const stage of stages) {
      const m = metrics.stages?.[stage];
      if (!m || m.width !== width || !(m.shellWidth > 100) || m.documentOverflow > 1) {
        errors.push(`Invalid stage geometry: ${metricsPath} ${stage}`);
      }
    }
    reports++;
  }
}
if (images !== 30 || reports !== 10) errors.push(`Incomplete evidence: ${images}/30 PNG, ${reports}/10 JSON`);
if (errors.length) {
  console.error(JSON.stringify({ ok: false, errors }, null, 2));
  process.exitCode = 1;
} else console.log(JSON.stringify({ ok: true, png: images, geometryJson: reports, root }, null, 2));
