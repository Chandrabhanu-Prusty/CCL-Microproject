# Test Plan

## 1. Authentication and authorization

- Register a new user; verify role defaults to `ATTENDEE`.
- Verify passwords are stored as hashes, not plaintext.
- Log in with valid credentials and verify a JWT is returned.
- Verify invalid credentials are rejected.
- Verify missing, malformed, expired, or tampered tokens are rejected.
- Verify attendees cannot create/edit events or access organizer statistics.
- Verify only organizers/coordinators can access protected staff routes.

## 2. Event management

- List published events, search by title, filter by category/date, and open event details.
- Create/edit an event as an organizer.
- Attempt the same actions as an attendee and verify rejection.
- Ensure capacity cannot be reduced below confirmed registrations without an explicit supported workflow.

## 3. RSVP and capacity

- RSVP when a seat is available; expect `CONFIRMED` and a ticket ID.
- RSVP twice for the same event; verify no duplicate active registration or seat consumption.
- Fill an event to capacity and submit another RSVP; expect `WAITLISTED`.
- Send concurrent requests for the final seat; no more than one may be confirmed.
- Verify confirmed count never exceeds capacity.
- Cancel a confirmed RSVP and verify ticket invalidation.
- Verify the oldest eligible waitlisted attendee is promoted.
- Verify a waitlisted attendee does not have an active ticket before promotion.

## 4. QR tickets and check-in

- Verify each confirmed RSVP has a unique opaque ticket ID.
- Verify QR does not contain passwords, JWTs, email addresses, or other sensitive information.
- Scan a valid ticket for the correct event; expect successful check-in.
- Scan the same ticket again; expect `ALREADY_CHECKED_IN`.
- Test unknown, cancelled, waitlisted, and wrong-event tickets.
- Deny camera permission and verify manual lookup is offered.
- Search manually by attendee name, email, or ticket reference.
- Confirm manual check-in uses the same backend validation as QR check-in.

## 5. Dashboard and deployment

- Verify confirmed, waitlisted, checked-in, and remaining-seat counts match stored records.
- Verify attendance percentage handles zero-registration edge cases safely.
- Test deployed frontend on desktop and mobile.
- Verify camera permission works on the HTTPS site where supported.
- Verify API CORS allows the exact frontend origin.
- Verify backend errors can be diagnosed through Lambda logs.

## 6. Evidence

Record test name, steps, expected result, actual result, pass/fail, and screenshot/API response where useful. Never include real passwords, JWTs, or secret values in evidence.
