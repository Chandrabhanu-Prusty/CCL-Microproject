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
  4. An organizer must explicitly delegate an event's check-in privileges to an existing registered user via `POST /api/events/{eventId}/staff`. Target users must already have an account (`USER_NOT_FOUND` returned if non-existent).
  5. The delegated user retains their `ATTENDEE` (or `ORGANIZER`) account role, but gains an event-scoped record in `MarqueEventStaff` with `permission: "CHECK_IN"`.
  6. **Organizer Check-in Requirement:** Organizers do not automatically receive scanning access. If an organizer wishes to scan tickets at their own event, they must explicitly assign themselves to the event's staff roster in `MarqueEventStaff`.
  7. **Check-in Summary Access:** `GET /api/events/{eventId}/checkin-summary` requires an explicit staff assignment in `MarqueEventStaff`.
  8. **Revocation Immediacy:** Revocation via `DELETE /api/events/{eventId}/staff/{userId}` instantly invalidates permissions on the next request because authorization is verified against `MarqueEventStaff` on every call, not cached in a client token.

---

### Decision 2: Controlled Organizer Provisioning Process
- **Context:** Public registration must never allow self-assignment of `ORGANIZER`.
- **Decision:**
  - For the MVP, all public signups produce `ATTENDEE` accounts.
  - Organizer accounts are provisioned via an administrative script (`scripts/seed-organizer.js`) or AWS CLI / DynamoDB console update setting `role = 'ORGANIZER'`.
  - In local mock mode, a dedicated demo persona switcher allows test evaluation of organizer flows, but the client cannot elevate roles when communicating with the real AWS backend.

---

### Decision 3: Atomic Email Uniqueness & Elimination of `email-index` GSI
- **Context:** DynamoDB Global Secondary Indexes (GSIs) are eventually consistent. Relying on `email-index` for uniqueness creates race conditions, and querying an eventually consistent GSI for authentication can fail right after registration.
- **Decision:**
  - To guarantee strict, atomic email uniqueness without table scans or eventual-consistency race conditions, user creation uses a DynamoDB transaction (`TransactWriteItems`) inserting two items into `MarqueUsers`:
    1. The primary user profile item (`PK: userId`, `SK: PROFILE`).
    2. An email lock item with `PK: EMAIL#<normalizedEmail>`, `SK: LOCK`, `ownerUserId: userId`, and condition `attribute_not_exists(userId)`.
  - For authentication and coordinator assignment by email, the backend performs a **two-step strongly consistent base table read**:
    1. Read `GetItem` on `MarqueUsers` (`PK: EMAIL#<normalizedEmail>`, `SK: LOCK`) to retrieve `ownerUserId`.
    2. Read `GetItem` on `MarqueUsers` (`PK: ownerUserId`, `SK: PROFILE`) to retrieve credentials and profile.
  - This eliminates `email-index` entirely, saving AWS GSI storage and write costs while delivering strongly consistent authentication.

---

### Decision 4: Deterministic FIFO Waitlist Lifecycle & Elimination of `attendee-waitlist-index`
- **Context:** Storing inactive/historical entries in `MarqueWaitlist` requires filter expressions during promotion queries and requires a GSI to locate an attendee's entry for self-cancellation.
- **Decision:**
  - `MarqueWaitlist` contains **only active waiting entries**.
  - When an attendee is promoted or cancels, their entry is **deleted** transactionally from `MarqueWaitlist`.
  - FIFO promotion query uses base table `Query` (`PK = eventId`, `ScanIndexForward = true`, `Limit = 1`, `ConsistentRead: true`) with **no filter expression**, guaranteeing deterministic $O(1)$ strongly consistent candidate selection.
  - When an attendee is waitlisted, their sort key `queueKey` (`<ISO8601_TIMESTAMP>#<attendeeId>`) is stored directly on their `MarqueRSVPs` record.
  - On self-cancellation, the backend reads `queueKey` from `MarqueRSVPs` and executes a direct base table `DeleteItem` (`PK: eventId`, `SK: queueKey`) on `MarqueWaitlist`.
  - This completely eliminates the need for `attendee-waitlist-index`. Total architecture GSIs are reduced to **6**.

---

### Decision 5: Non-Conflicting RSVP Lifecycle & Safe Re-registration
- **Context:** When an attendee cancels their RSVP and later wants to re-register, a static `eventId + attendeeId` partition key might cause overwrites or stale state.
- **Decision:**
  - In `MarqueRSVPs`, partition key is `eventId` and sort key is `attendeeId`.
  - When cancelled, status transitions to `CANCELLED`.
  - If the user re-registers, the conditional check permits updating from `CANCELLED` to `CONFIRMED` or `WAITLISTED`, regenerating a new `ticketId` (or `queueKey`) and recording `updatedAt`.
  - This guarantees exactly one active registration per attendee per event while preserving audit history.

---

### Decision 6: Privacy-Preserving Attendee Search for Staff
- **Context:** Exposing full attendee rosters to coordinators leaks student PII and enables directory harvesting.
- **Decision:**
  - Coordinators must supply a minimum 2-character search query parameter `q` (`GET /api/events/{eventId}/attendees?q={query}`).
  - Responses for coordinators omit sensitive details, returning only `ticketId`, `attendeeName`, masked email (e.g. `ch***@example.com`), `status`, and `checkedInAt`.
  - Unrestricted full-roster inspection is strictly reserved for the event owner (`ORGANIZER`).

---

### Decision 7: Separation of Organizer Analytics and Staff Check-in Summaries
- **Context:** Coordinators need to know how many attendees have been admitted, but should not have access to full organizer analytics (waitlist depths, historical trends).
- **Decision:**
  - `GET /api/events/{eventId}/stats` is strictly restricted to the event organizer.
  - `GET /api/events/{eventId}/checkin-summary` is introduced for assigned coordinators (and organizers explicitly assigned to the event), returning only `confirmedCount` and `checkedInCount`.

---

### Decision 8: Standardized Response Envelopes
- **Context:** Inconsistencies between naked event models and enveloped objects `{ "event": ... }` can cause frontend parsing bugs.
- **Decision:**
  - `POST /api/events` (Create Event) and `PATCH /api/events/{eventId}` (Update Event) strictly return `{ "event": { ... } }`, matching `GET /api/events/{eventId}` and the OpenAPI 3.1 specification.
