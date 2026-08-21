# Staff access

Protected Workforce routes use Cloudflare Access authentication and the private `WorkforceControlPlane` Core service binding. Core resolves the verified external identity to an ACTIVE Access User, derives the linked ACTIVE StaffMember, and evaluates current permissions for every request.

Legacy `?t=`, username, and mobile values are ignored and cannot authenticate or select a StaffMember. There is no Workforce fallback to Notion.
