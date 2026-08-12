# Staff access

Each Staff record uses a unique random value in the exact Notion property `username` as its bearer-style access key.

Staff URL:
`https://pino-team-os.minhtri-van42.workers.dev/s/<username>/schedule`

The Cloudflare Worker middleware extracts the key from the URL, the server resolves it against Notion Staff, and only the matched staff member's data is rendered.

Treat `username` as a password: generate high-entropy random values, never commit them to source control, and rotate the value in Notion if a link leaks. Staff pages are `noindex` and `no-store`.

Cloudflare Access email authentication is not used by the application. If Access is enabled on the workers.dev hostname, it must be disabled or configured to bypass the staff routes; Access runs before the Worker and can otherwise block the request.
