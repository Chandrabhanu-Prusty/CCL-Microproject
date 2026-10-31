# Architectural & Database Design Decisions (ADR Log)

## Status: FINALIZED & FROZEN
**Project:** Marque (CCL-Microproject)  
**Date:** 2026-10-31  
**Scope:** API Contract, DynamoDB Relational Invariants, Role-Based Access Control, Concurrency Safeguards  

---

### Decision 1: Pure Two-Tier Global Roles & Event-Scoped Check-in Delegation
- **Context:** Previous iterations treated `COORDINATOR` as a global account role alongside `ATTENDEE` and `ORGANIZER`, or automatically granted organizers check-in scanner permissions across all events.
- **Decision:** 
  1. Global account roles in `MarqueUsers` and JWT payloads are strictly limited to `ATTENDEE` and `ORGANIZER`.
  2. Public registration (`POST /api/auth/register`) strictly sets `role: "ATTENDEE"`.
  3. `COORDINATOR` is **never** a global account role and is **never** embedded in a JWT.
  4. An organizer must explicitly delegate an event's check-in privileges to an existing registered user via `POST /api/events/{eventId}/staff`.
  5. The delegated user retains their `ATTENDEE` (or `ORGANIZER`) account role, but gains an event-scoped record in `MarqueEventStaff`.
  6. **Organizer Check-in:** Organizers do not automatically receive scanning access. If an organizer wishes to scan at their own event, they must assign themselves as staff or have their explicit check-in record in `MarqueEventStaff`.
  7. **Revocation Immediacy:** Revocation via `DELETE /api/events/{eventId}/staff/{userId}` instantly invalidates permissions on the next request because authorization is verified against `MarqueEventStaff` on every call, not cached in a client token.

---

### Decision 2: Controlled Organizer Provisioning Process
- **Context:** Public registration must never allow self-assignment of `ORGANIZER`.
- **Decision:**
  - For the MVP, all public signups produce `ATTENDEE` accounts.
  - Organizer accounts are provisioned via an administrative script (`scripts/seed-organizer.js`) or AWS CLI / DynamoDB console update setting `role = 'ORGANIZER'`.
  - In local mock mode, a dedicated demo persona switcher allows test evaluation of organizer flows, but the client cannot elevate roles when communicating with the real AWS backend.

---

### Decision 3: Atomic Email Uniqueness via Dedicated Lock Records
- **Context:** DynamoDB Global Secondary Indexes (GSIs) are eventually consistent. Querying a GSI (`email-index`) prior to a `PutItem` creates a classic race condition where concurrent registrations with the same email both succeed.
- **Decision:**
  - To guarantee strict, atomic email uniqueness without table scans or eventual-consistency race conditions, user creation uses a DynamoDB transaction (`TransactWriteItems`) inserting two items:
    1. The primary user item in `MarqueUsers` (`PK: userId`).
    2. An email lock item in `MarqueUsers` with `PK: EMAIL#<normalizedEmail>` and condition `attribute_not_exists(userId)`.
  - This eliminates the need for an extra table while providing strongly consistent uniqueness enforcement.

---

### Decision 4: Deterministic FIFO Waitlist with Strongly Consistent Base Table Queries
- **Context:** Relying on a GSI for FIFO waitlist ordering introduces eventual consistency lag during high-concurrency ticket promotion/cancellation.
- **Decision:**
  - In `MarqueWaitlist`, the table partition key is `eventId` and the sort key is `queueKey` (`<ISO8601_TIMESTAMP>#<attendeeId>`), with an attribute `attendeeId`.
  - This allows a **strongly consistent** base table `Query` (`PK = eventId`, `ScanIndexForward = true`, `Limit = 1`) to retrieve the exact oldest waitlisted user for promotion.
  - A GSI `attendee-index` (`PK: attendeeId`, `SK: eventId`) allows $O(1)$ lookups to find and cancel a user's waitlist record.

---

### Decision 5: Non-Conflicting RSVP Lifecycle & Safe Re-registration
- **Context:** When an attendee cancels their RSVP and later wants to re-register, a static `eventId + attendeeId` partition key might cause overwrites or stale state.
- **Decision:**
  - In `MarqueRSVPs`, partition key is `eventId` and sort key is `attendeeId`.
  - When cancelled, status transitions to `CANCELLED`.
  - If the user re-registers, the conditional check permits updating from `CANCELLED` to `CONFIRMED` or `WAITLISTED`, regenerating a new `ticketId` and recording `updatedAt`.
  - This guarantees exactly one active registration per attendee per event while preserving audit history.

---

### Decision 6: Privacy-Preserving Attendee Search for Staff
- **Context:** Exposing full attendee rosters to coordinators leaks student PII and enables directory harvesting.
- **Decision:**
  - Coordinators must supply a minimum 2-character search query parameter `q` (`GET /api/events/{eventId}/attendees?q={query}`).
  - Responses for coordinators omit sensitive details, returning only `ticketId`, `attendeeName`, masked email, and `status`.
  - Unrestricted full-roster inspection is strictly reserved for the event owner (`ORGANIZER`).

---

### Decision 7: Separation of Organizer Analytics and Staff Check-in Summaries
- **Context:** Coordinators need to know how many attendees have been admitted, but should not have access to full organizer analytics (waitlist depths, historical trends).
- **Decision:**
  - `GET /api/events/{eventId}/stats` is strictly restricted to the event organizer.
  - `GET /api/events/{eventId}/checkin-summary` is introduced for assigned coordinators, returning only `confirmedCount` and `checkedInCount`.

