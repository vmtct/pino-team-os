// PAP-1838 / PNR-IDENTITY — serve only approved Piner Staging document routes.
// Keep the login entrypoint reachable without broadening the public/member surface.
const PUBLIC_DOCUMENT_ROOTS = ["/piner-space", "/piner-prototype"];
const STATIC_PREFIXES = ["/_next/", "/cdn-cgi/image/"];

export function isAllowedPath(pathname) {
  if (typeof pathname !== "string") return false;
  if (pathname === "/piner/public/login" || pathname === "/piner/public/login/") return true;
  if (PUBLIC_DOCUMENT_ROOTS.some((root) => pathname === root || pathname.startsWith(root + "/"))) return true;
  return STATIC_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}