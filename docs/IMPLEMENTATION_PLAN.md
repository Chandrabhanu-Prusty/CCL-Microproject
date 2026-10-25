# Implementation Plan — 2 to 3 Days

## Phase 0: Shared setup (first 60–90 minutes)

All members:
1. Read the project overview, architecture, API contract, database design, and team responsibilities.
2. Scaffold the agreed folders.
3. Confirm API routes, status values, and data keys.
4. Create branches and confirm everyone can pull/push the repository.
5. Confirm AWS access and whether a permitted Lambda execution role is available.
6. Agree on environment variable names.

**Exit criteria:** no unresolved ownership questions; frontend and backend can work in parallel.

## Day 1: Build foundations in parallel

### Chandrabhanu
- Scaffold React/Vite.
- Build responsive layout, event list, event details, search/filter.
- Use mock data until the API is ready.
- Create auth pages and API service wrapper.

### Neilsen
- Set up backend project and Lambda entry point.
- Implement register/login, JWT utilities, and role checks.
- Configure API Gateway and a health endpoint.
- Implement event list/details and organizer create/update routes.

### Preeti
- Finalize DynamoDB tables/indexes.
- Implement RSVP, duplicate prevention, and conditional capacity update.
- Implement waitlist insertion and initial cancellation/promotion logic.
- Start API/Postman tests.

**Day 1 target:** frontend skeleton runs; API health/auth/event routes work; data model and booking logic are in progress.

## Day 2: Complete core workflows and integrate

Morning:
- Finish capacity-safe RSVP and FIFO waitlist.
- Finish cancellation/promotion.
- Finish ticket record creation and check-in validation.
- Finish QR ticket page, scanner, and manual lookup.
- Integrate event listing, login, RSVP, and My Registrations.

Afternoon:
- Deploy backend to Lambda and API Gateway.
- Deploy frontend to Vercel.
- Configure CORS and environment variables.
- Test organizer/coordinator authorization.
- Test full event, cancellation, promotion, QR scan, manual lookup, and repeat scan.
- Fix critical integration defects.

**Day 2 target:** deployed end-to-end MVP.

## Day 3: Stabilization and submission buffer

- Test mobile camera access and manual fallback.
- Fix priority bugs.
- Verify capacity and check-in concurrency.
- Complete README and documentation.
- Capture screenshots and prepare demo script.
- Record known limitations honestly.

## Priority if time is tight

1. Authentication and event listing.
2. RSVP with capacity protection.
3. Waitlist and cancellation/promotion.
4. Ticket QR display.
5. Check-in and manual fallback.
6. Organizer dashboard and polish.
7. Optional S3 banner upload.

Do not sacrifice backend capacity correctness or single-use check-in for cosmetic features.
