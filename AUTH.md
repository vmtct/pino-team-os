# PINO Team OS — Authentication & Authorization

## Identity

Production requests are authenticated by Cloudflare Access. The app verifies the `CF-Access-JWT-Assertion` JWT against Cloudflare Access JWKS and checks both issuer and audience.

Required production variables:

- `CF_ACCESS_TEAM_DOMAIN`
- `CF_ACCESS_AUDIENCE`

## Staff mapping

After JWT verification, the app maps the identity to Notion Staff in this order:

1. `User ID` = Cloudflare Access JWT `sub`
2. `Email` = Cloudflare Access JWT `email` (case-insensitive fallback)

The canonical `User ID` field remains the preferred mapping key.

## Authorization

Authorization is based on the Notion `App Access` property. `Role` is not used as the authorization source.

The Team directory is protected by `PINO_TEAM_ACCESS`, which must contain the exact allowed `App Access` values, separated by commas.

Example:

`PINO_TEAM_ACCESS=Admin,Manager`

## Local development

When `NODE_ENV=development`, the middleware allows requests without Cloudflare Access so the UI can be developed locally. `/me` will show that no authenticated identity is available until Access is present.

Production does not have this bypass.

## Security boundary

Do not put `NOTION_TOKEN` or Cloudflare Access secrets in client-side code. Notion access and authorization checks stay server-side.
