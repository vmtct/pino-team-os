# Staff schedule access

Each Staff record uses a unique random value in the exact Notion property `username` as its bearer-style access key.

Staff schedule URL:
`https://pino-team-os.minhtri-van42.workers.dev/schedule?t=<username>`

The `/schedule` page reads query parameter `t`, resolves it against Notion Staff, and renders only the matched staff member's current schedule.

There is no email authentication, Cloudflare Access identity, session, or client-side Notion access in this flow.

Treat `username` as a password: generate high-entropy random values, never commit them to source control, and rotate the value in Notion if a link leaks. Schedule responses are dynamic and not intended for indexing or shared caching.
