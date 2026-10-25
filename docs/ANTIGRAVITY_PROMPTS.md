# Antigravity Prompt Library

Use these prompts from the repository root. Give Antigravity one scoped task at a time. Before running a prompt, confirm you are on the correct Git branch.

## Prompt 1 — Create the folder structure only

```text
We are setting up the existing GitHub repository CCL-Microproject for Marque, a responsive campus event RSVP and QR-ticket web app.

First inspect the existing repository. Preserve all existing files and do not overwrite any documentation or code that already exists.

Create this directory structure and add .gitkeep files only where a directory would otherwise be empty. Create or update .gitignore only if needed to ignore node_modules, build output, .env files, local secrets, and OS/editor files.

frontend/
  public/
  src/assets/
  src/components/
  src/layouts/
  src/pages/
  src/routes/
  src/services/
  src/auth/
  src/hooks/
  src/utils/
  src/styles/
backend/
  src/router/
  src/handlers/auth/
  src/handlers/events/
  src/handlers/rsvp/
  src/handlers/tickets/
  src/handlers/checkin/
  src/handlers/stats/
  src/handlers/uploads/
  src/middleware/
  src/services/
  src/repositories/
  src/utils/
  src/config/
  tests/unit/
  tests/integration/
docs/
scripts/

Do not implement application features yet. Do not install packages yet. Do not create fake AWS IDs, credentials, API URLs, or secrets. Do not overwrite README.md or any files in docs/. Do not create a second nested project folder. Work in the current repository root.

When finished, show the resulting tree and summarize exactly which files/folders were created. Stop and wait for the next instruction.
```

## Prompt 2 — Frontend shell (Chandrabhanu)

```text
Read README.md and docs/PROJECT_OVERVIEW.md, ARCHITECTURE.md, API_CONTRACT.md, and TEAM_RESPONSIBILITIES.md. Implement only the frontend in frontend/ using React + Vite.

Build a responsive, accessible web UI for Marque: event listing/search/filter, event details, sign-in/register, My Registrations, digital QR ticket, organizer dashboard, and coordinator check-in with both browser-camera scanning and manual attendee/ticket lookup. Use VITE_API_BASE_URL for API calls. Keep API calls in frontend/src/services and auth helpers in frontend/src/auth. Do not hardcode API URLs, AWS IDs, secrets, sample credentials, or production tokens.

Follow API_CONTRACT.md. Display actual backend statuses rather than assuming success. The QR must contain only the opaque ticket ID. If camera permission is denied or scanning fails, clearly offer manual lookup. Stop camera streams when the scanner is closed or the page unmounts.

Use mock data only where the API is not implemented yet, and isolate it so it can be removed easily. Do not modify backend logic or AWS setup. Add loading, empty, and error states. Run available checks and report changed files and test results.
```

## Prompt 3 — Authentication, API and event functions (Neilsen)

```text
Read README.md and docs/PROJECT_OVERVIEW.md, ARCHITECTURE.md, API_CONTRACT.md, DATABASE_DESIGN.md, AWS_SETUP_GUIDE.md, SECURITY.md, and TEAM_RESPONSIBILITIES.md.

Implement the backend foundation in backend/ for Marque using Node.js on AWS Lambda, API Gateway HTTP API, and DynamoDB. Keep the first deployment simple: one Lambda entry handler with internal routing and separated modules. Use API_CONTRACT.md.

Implement register/login using bcrypt password hashing and signed JWTs. Store only password hashes. New users must default to ATTENDEE; never accept privileged roles from public registration. Create shared JWT verification and role-check middleware. Implement event list/details/create/update handlers with organizer authorization and validation. Use DATABASE_DESIGN.md; if a change is required, explain it and update docs rather than silently diverging.

Read table names, region, S3 bucket, and JWT secret from environment variables. Never hardcode secrets or commit .env files. Use AWS SDK v3. Return consistent JSON responses and errors. For this custom JWT design, verify JWTs in Lambda middleware; do not configure an API Gateway managed JWT authorizer without a compatible issuer/JWKS setup.

Do not implement RSVP/waitlist/check-in domain logic owned by Preeti except shared interfaces/placeholders. Do not change frontend. Add a health route, tests where practical, setup notes, and report what remains for AWS console setup.
```

## Prompt 4 — DynamoDB booking and check-in logic (Preeti)

```text
Read README.md and docs/PROJECT_OVERVIEW.md, ARCHITECTURE.md, API_CONTRACT.md, DATABASE_DESIGN.md, SECURITY.md, TEST_PLAN.md, and TEAM_RESPONSIBILITIES.md.

Implement RSVP, capacity, waitlist, ticket, attendee search, statistics, and check-in modules in backend/ using the agreed DynamoDB design and API contract. Coordinate shared helper interfaces with Neilsen instead of creating a second Lambda entry point or changing authentication conventions.

Prevent duplicate active RSVPs. Use DynamoDB conditional writes/transactions so confirmedCount never exceeds capacity during concurrent requests. If full, add the attendee to a FIFO waitlist. On cancellation, invalidate the old ticket and safely promote the oldest eligible waitlisted attendee; protect promotion with conditions and handle transaction conflicts. Only confirmed registrations may have active tickets. QR contains an opaque ticket ID only. Check-in must be a conditional single-use update. Manual lookup must call the same backend validation logic.

Do not trust seat counts, user IDs, roles, event ownership, or check-in status supplied by the frontend. Read table names from environment variables. Do not hardcode credentials or API URLs. Add tests for duplicate RSVP, concurrent last-seat booking, full-event waitlist, cancellation/promotion, invalid ticket, and repeated check-in. Do not change frontend pages or AWS resource names without agreement. Report changed files and test results.
```

## Prompt 5 — Integration review

```text
Review the current repository against docs/API_CONTRACT.md, DATABASE_DESIGN.md, TEST_PLAN.md, and SECURITY.md. Do not rewrite the application from scratch. Identify mismatches between frontend requests, Lambda routes, DynamoDB keys, status names, and role checks. Fix only confirmed integration defects, preserve teammate module boundaries, run available tests, and summarize each fix. Never invent AWS resource names, secrets, or deployed URLs.
```
