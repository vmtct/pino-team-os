/**
 * PAP-926 BO Architecture V1: declarative Level-1 module registration.
 * Static CI validates the literal registry; actual Core services remain the
 * authority for data, grants and persisted public Saved Views.
 */
export type BoFieldType =
  | "id" | "text" | "textarea" | "number" | "currency" | "date" | "datetime"
  | "select" | "multiselect" | "relation" | "multirelation" | "person"
  | "boolean" | "email" | "url" | "formula";
export type BoModuleField = Readonly<{
  key: string;
  label: string;
  type: BoFieldType;
  readOnly?: boolean;
}>;
export type BoModuleContract = Readonly<{
  key: string;
  href: `/bo/${string}`;
  label: string;
  kind: "entity";
  permissions: Readonly<{ read: string; write: string }>;
  fields: readonly BoModuleField[];
  publicViews: "module-shared";
  quickView: "canonical-properties";
  fullDetail: "shared-tabs";
}>;
export function defineBoModule<T extends BoModuleContract>(definition: T): T {
  if(!/^([a-z][a-z0-9]*)(-[a-z0-9]+)*$/.test(definition.key) ||
    !/^\/bo\/[a-z0-9/-]+$/.test(definition.href) ||
    !definition.fields.some(field => field.key==="id" && field.type==="id" && field.readOnly===true) ||
    !definition.fields.some(field=>field.key!=="id") ||
    !definition.permissions.read || !definition.permissions.write ||
    !definition.label.trim() || definition.publicViews!=="module-shared" ||
    definition.quickView!=="canonical-properties" ||
    definition.fullDetail!=="shared-tabs") {
    throw new Error("BO module contract is incomplete or invalid");
  }
  const keys = definition.fields.map(field=>field.key);
  if (new Set(keys).size !== keys.length) throw new Error("Duplicate BO module property key");
  return definition;
}
export function defineBoModuleRegistry<T extends readonly BoModuleContract[]>(definitions: T): T {
  const keys=new Set<string>(),paths=new Set<string>();
  for(const def of definitions){
    defineBoModule(def);
    if(keys.has(def.key)||paths.has(def.href))throw new Error("Duplicate BO module key or route");
    keys.add(def.key);paths.add(def.href);
  }
  return definitions;
}
