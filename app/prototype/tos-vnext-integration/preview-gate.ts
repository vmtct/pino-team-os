/**
 * PAP-938 source-safety fence: the diagnostic VNext integration route must not
 * be exposed by a merged build, including any Production/Staging Worker.
 * A preview is available only in a developer's local Next dev server and
 * requires an explicit server-side flag. Never use NEXT_PUBLIC_ for this.
 */
export function allowPap938LocalPreview(env: {
 NODE_ENV?: string;
 PAP938_VNEXT_LOCAL_PREVIEW?: string;
}): boolean {
 return env.NODE_ENV === "development" &&
        env.PAP938_VNEXT_LOCAL_PREVIEW === "true";
}
