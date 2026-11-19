import { readFile } from "node:fs/promises";
import { runStaging } from "./staging.mjs";

// Each feature supplies its own expected native shell and read endpoint.
async function listCase(key, actorId, scope, observe) {
  if (!/^[a-z0-9-]+$/.test(key)) throw Error("Invalid BO case name");
  const manifest = JSON.parse(await readFile(new URL("./cases/bo/" + key + ".json", import.meta.url), "utf8"));
  const {path, ticket, endpoint} = manifest.stagingList;
  return {
    key, actorId, scope, path,
    async run(page) {
      const section = page.locator('[data-pap-ticket="' + ticket + '"]');
      const table = section.locator('[data-tdd-shell="table"]');
      try {
        await table.locator("thead th").first().waitFor();
        const outcome = table.locator("tbody tr[data-record], tbody .empty-table:not([role]) strong, tbody [role=alert]");
        await outcome.first().waitFor();
        if (await table.locator("[role=alert]").isVisible()) throw Error("BO_LIST_ALERT");
      } finally {
        // Record only status codes and DOM flags, including on failure.
        const status = await page.evaluate(path => performance.getEntriesByType("resource")
          .filter(entry => new URL(entry.name).pathname === path).map(entry => entry.responseStatus), endpoint);
        observe?.({key, status, shell:await table.isVisible(), alert:await section.getByRole("alert").count(),
          rows:await table.locator("tbody tr[data-record]").count(),
          empty:await table.locator("tbody .empty-table:not([role]) strong").isVisible()});
      }
    }
  };
}

export async function runPayrollListBatch({features,actorId,centerId,withProfile,readServing,observe}) {
  const cases = await Promise.all(features.map(key => listCase(key, actorId, centerId, observe)));
  return runStaging({
    surface:"bo", cases, withProfile,
    async verify(page, profile, item) {
      if (profile.role !== "Manager" || new URL(page.url()).pathname !== item.path) throw Error("Wrong BO scope");
      const proof = await page.evaluate(async center => {
        const selected = localStorage.getItem("pino:bo:active-center:v1");
        const response = await fetch("/api/bo/context?" + new URLSearchParams({centerId:center}), {cache:"no-store"});
        const data = response.ok ? (await response.json()).data : null;
        return {actorId:data?.userId, scope:selected, authorized:data?.surface === "BO" &&
          data.entitled === true && data.permissionKeys?.includes("team.bo.access") === true};
      }, centerId);
      return {...proof, ...await readServing()};
    }
  });
}
