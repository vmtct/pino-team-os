#!/usr/bin/env node
import { pathToFileURL } from "node:url";

const [location, expectedHost] = process.argv.slice(2);

function classifyRedirect(rawLocation, host) {
  if (!rawLocation || !host) return "INVALID";
  if (rawLocation === "/staff-login") return "LOCAL";

  let url;
  try {
    url = new URL(rawLocation);
  } catch {
    return "INVALID";
  }

  const expected = host.toLowerCase();
  const hostname = url.hostname.toLowerCase();

  if (
    url.protocol === "https:" &&
    url.port === "" &&
    hostname === expected &&
    url.pathname === "/staff-login" &&
    url.search === "" &&
    url.hash === ""
  ) {
    return "LOCAL";
  }

  if (
    url.protocol === "https:" &&
    url.port === "" &&
    (hostname === "cloudflareaccess.com" || hostname.endsWith(".cloudflareaccess.com"))
  ) {
    return "ACCESS";
  }

  return "INVALID";
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.stdout.write(classifyRedirect(location ?? "", expectedHost ?? "") + "\n");
}

export { classifyRedirect };
