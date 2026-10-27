export const TOS_V4_STAGING_HOSTS=["tos.staging.pinohouse.art","pino-team-os-staging.minhtri-van42.workers.dev"] as const;
export function tosV4StagingHost(host:string){return TOS_V4_STAGING_HOSTS.some(value=>value===host.trim().toLowerCase())}
