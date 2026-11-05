/** UI-only fallback: authenticated email is authoritative if Core supplies a placeholder name. */
export function resolveBoAccountLabel(displayName: string | null, email: string): { name: string; subtitle: string } {
  const canonicalEmail = email.trim();
  const candidate = displayName?.trim() ?? "";
  const placeholder = /(?:^|\s)mock$/i.test(candidate) || /^tài khoản$/i.test(candidate);
  const name = !candidate || placeholder ? canonicalEmail : candidate;
  return { name, subtitle: name === canonicalEmail ? "Back Office" : canonicalEmail };
}
