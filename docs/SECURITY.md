# Security Notes

## Authentication
- Hash passwords using a suitable password-hashing library such as `bcryptjs`.
- Never store or log plaintext passwords.
- Sign JWTs with a strong secret configured outside source control.
- Include a stable user ID, role, issued-at time, and expiry in the token.
- Verify signature and expiry for every protected request.
- Keep token lifetime limited and clear client-side token state on logout.
- Never put JWTs in URLs or QR codes.

## Authorization
- Enforce role checks in backend code.
- New registrations default to `ATTENDEE`.
- Do not trust `role`, `organizerId`, `checkedInBy`, or capacity values supplied by untrusted clients.
- Check event ownership for organizer edit operations.
- Restrict attendee search to authorized staff and a specific event.

## AWS permissions
- Lambda must use an AWS execution role to access DynamoDB, S3, and logs.
- Grant least privilege to required tables, indexes, and bucket paths.
- Do not use personal AWS credentials in browser code or commit them to GitHub.
- Keep S3 Block Public Access enabled; use short-lived presigned URLs for uploads if implemented.

## QR tickets
- QR contains an opaque ticket identifier only.
- A QR code is not proof by itself; the backend must validate its record and status.
- Check-in must be an atomic conditional update so two simultaneous scans cannot both succeed.
- Cancelled and waitlisted registrations must not be accepted as valid tickets.
- Manual lookup must invoke the same backend validation logic as scanning.

## Data handling
- Return only the minimum attendee information needed for a workflow.
- Do not log JWTs, passwords, or sensitive request bodies.
- Validate and limit uploaded image type and size.
- Use HTTPS for the deployed frontend and API.
