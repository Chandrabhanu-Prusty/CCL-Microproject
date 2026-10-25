# Team Responsibilities

## Shared rules

- Shared repository: https://github.com/Chandrabhanu-Prusty/CCL-Microproject
- Agree on `API_CONTRACT.md` and `DATABASE_DESIGN.md` before integrating.
- Work on separate feature branches; commit small, testable changes.
- Do not commit secrets or `.env` files.
- Open pull requests and request review before merging to `main`.
- Each member owns implementation/testing of their assigned work; all members help with final integration.

## Chandrabhanu — Frontend and integration

**Branch:** `feature/frontend`

Tasks:
- Set up React + Vite and shared frontend structure.
- Build event listing, search/filter, event details, and registration pages.
- Build sign-in/register UI and connect to auth endpoints.
- Build My Registrations and digital ticket display.
- Generate QR code from the opaque ticket ID returned by the backend.
- Build camera scanner UI and handle permission/error states.
- Build manual attendee/ticket lookup UI.
- Build organizer dashboard and statistics views.
- Integrate API calls using `VITE_API_BASE_URL`.
- Deploy to Vercel with HTTPS and test camera access on a real mobile browser.

**Deliverables:** working frontend, API integration, scanner/manual lookup, Vercel URL, screenshots.

## Neilsen — JWT authentication, API Gateway, Lambda event APIs

**Branch:** `feature/aws-auth-events`

Tasks:
- Set up shared backend conventions and Lambda entry point.
- Implement register/login with bcrypt password hashing.
- Implement signed JWT generation, verification middleware, and role checks.
- Ensure new accounts default to `ATTENDEE`; never accept privileged roles from public registration.
- Implement event list/details/create/update handlers with organizer authorization.
- Configure API Gateway HTTP API and CORS.
- Configure Lambda environment variables and the permitted execution role.
- Coordinate request/response contracts with the frontend and Preeti.
- Help deploy/test the API and document AWS resource names and endpoint base URL.

**Deliverables:** authentication, event APIs, API Gateway/Lambda configuration, shared API documentation.

## Preeti — DynamoDB, RSVP, waitlist, tickets, check-in

**Branch:** `feature/rsvp-waitlist-checkin`

Tasks:
- Finalize DynamoDB keys and indexes with Neilsen.
- Implement repositories for events, RSVPs, waitlist, and tickets.
- Implement duplicate-registration prevention.
- Implement capacity-safe RSVP with conditional writes/transactions.
- Implement FIFO waitlist insertion and safe cancellation/promotion.
- Implement ticket creation/activation and cancellation.
- Implement ticket validation and conditional single-use check-in.
- Implement attendee search and organizer statistics queries with the agreed contract.
- Create Postman/API tests and record results.

**Deliverables:** DynamoDB design, RSVP/waitlist/check-in backend, tests, and test evidence.

## Dependencies

- Chandrabhanu needs the API contract and stable response shapes from Neilsen and Preeti.
- Neilsen needs agreed DynamoDB access patterns from Preeti.
- Preeti needs event and user ID conventions from Neilsen.
- All three need the final route list before integration.

## Handover checklist

Include files changed, how to run/test, required environment variable names (never values), API routes implemented, known limitations, and screenshots/test output when useful.
