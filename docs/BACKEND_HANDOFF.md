# Backend Developer Handoff Specification

**Project:** Marque Campus Event Management Platform  
**Target Architecture:** AWS Serverless (Amazon API Gateway HTTP API + AWS Lambda Node.js 22.x + Amazon DynamoDB + Amazon S3)  
**Contract Baseline:** `docs/API_CONTRACT.md` & `docs/openapi.yaml` (Frozen)  
**Database Schema Baseline:** `docs/DATABASE_DESIGN.md` (Frozen)  

---

## 1. Division of Responsibilities

```
+----------------------------------------------------+----------------------------------------------------+
| NEILSEN                                            | PREETI                                             |
| Auth, Event Studio & Staff Delegation Handlers      | Transactional RSVP, Waitlist, Check-in & Analytics  |
+----------------------------------------------------+----------------------------------------------------+
| 1. Lambda Router & Middleware Foundation           | 1. DynamoDB Table Provisioning (6 Tables & 6 GSIs) |
| 2. User Authentication (Bcrypt + Base Email Lock)  | 2. Capacity-Safe RSVP Engine (TransactWriteItems)  |
| 3. Stateless Bearer JWT Issuance & Verification    | 3. Deterministic FIFO Waitlist Engine              |
| 4. User Repository (MarqueUsers - No GSI)          | 4. RSVP Cancellation & Atomic Waitlist Promotion   |
| 5. Event Repository (MarqueEvents)                 | 5. Digital Pass Issuance & Retrieval               |
| 6. Event CRUD Handlers (GET, POST, PATCH)          | 6. Attendee Search Handler (Masked PII for Staff)  |
| 7. Organizer Ownership Validation                  | 7. Single-Use Check-in Handler (Explicit Staff)    |
| 8. Staff Delegation Handlers (MarqueEventStaff)    | 8. Attendance Statistics & Check-in Summary        |
| 9. S3 Presigned URL Handler                        | 9. Concurrency & Race Condition Tests              |
+----------------------------------------------------+----------------------------------------------------+
```

---

## 2. Shared Integration Requirements & Architectural Ground Rules

Both developers must strictly comply with the following architectural invariants:

### Rule 1: Single Source of Truth
- Both developers must implement endpoints strictly as defined in `docs/API_CONTRACT.md` and `docs/openapi.yaml`.
- Event creation (`POST /api/events`) and update (`PATCH /api/events/{eventId}`) must wrap the response payload in `{ "event": { ... } }`.
- Neither developer may add, remove, or modify an endpoint path, HTTP method, query parameter, or status code without prior written coordination.

### Rule 2: Unified DynamoDB Table & GSI Names
Both developers must reference the exact table and index names via shared configuration constants:
- **Tables (6 Tables):**
  - `USERS_TABLE` = `MarqueUsers`
  - `EVENTS_TABLE` = `MarqueEvents`
  - `EVENT_STAFF_TABLE` = `MarqueEventStaff`
  - `RSVPS_TABLE` = `MarqueRSVPs`
  - `WAITLIST_TABLE` = `MarqueWaitlist`
  - `TICKETS_TABLE` = `MarqueTickets`
- **Global Secondary Indexes (Exactly 6 GSIs):**
  1. `status-startAt-index` (on `MarqueEvents`)
  2. `organizer-index` (on `MarqueEvents`)
  3. `user-assigned-events-index` (on `MarqueEventStaff`)
  4. `attendee-index` (on `MarqueRSVPs`)
  5. `event-attendees-index` (on `MarqueTickets`)
  6. `attendee-tickets-index` (on `MarqueTickets`)

*(Note: `email-index` on `MarqueUsers` and `attendee-waitlist-index` on `MarqueWaitlist` are eliminated in favor of strongly consistent base table reads and direct key deletions).*

### Rule 3: Uniform ID Prefixes & Formats
All generated entity identifiers must follow standard prefixes:
- User IDs: `usr-<random_hex/uuid>` (e.g., `usr-8f3a9e1b2c4d`)
- Event IDs: `evt-<slug_or_hex>` (e.g., `evt-ccl-hackathon-2026`)
- RSVP IDs: `rsvp-<random_hex>` (e.g., `rsvp-9a8b7c6d`)
- Ticket IDs: `tkt-<random_opaque_hex>` (e.g., `tkt-8f3a9e1b2c4d`) — Strictly random and opaque!
- Queue Keys: `<ISO8601_TIMESTAMP>#<userId>` (e.g., `2026-11-15T09:00:00.000Z#usr-8f3a9e1b2c4d`)

### Rule 4: Standard Error Response Structure
Every error returned by any handler must conform to the unified error response schema:
```json
{
  "error": {
    "code": "STRING_ERROR_CODE",
    "message": "User-safe error explanation.",
    "details": {}
  }
}
```
*Note:* Standard error helper functions must be placed in `backend/src/utils/errors.js` and imported by all controllers.

### Rule 5: Shared Authentication Middleware
- Authentication middleware (`backend/src/middleware/authMiddleware.js`) must unpack the Bearer JWT from `event.headers.authorization`.
- Verifies the signature using `process.env.JWT_SECRET` (algorithm `HS256`).
- Injects `req.user = { userId, email, role }` into the request context.
- If the token is missing, expired, or tampered with, returns HTTP 401 with code `UNAUTHORIZED`.

### Rule 6: Stakeholder Role & Delegation Rules
- `req.user.role` is strictly either `ATTENDEE` or `ORGANIZER`.
- `COORDINATOR` is never a global role or JWT claim.
- **Explicit Check-in Staff Requirement:** Venue ticket check-in (`POST /api/events/{eventId}/check-in`) and check-in summary (`GET /api/events/{eventId}/checkin-summary`) require an explicit assignment record in `MarqueEventStaff`. If an event organizer wishes to scan tickets, they must assign themselves to the event's staff roster.
- Handlers in Preeti's check-in scope must query `MarqueEventStaff` via Neilsen's shared staff check helper:
  ```javascript
  const isAuthorized = await eventStaffRepository.isUserAssigned(eventId, req.user.userId);
  if (!isAuthorized) {
    return forbidden('Explicit staff assignment required for check-in');
  }
  ```

---

## 3. Detailed Work Breakdown

### Scope 1: Neilsen's Deliverables

#### Directory Targets:
- `backend/src/router/`
- `backend/src/handlers/auth/`
- `backend/src/handlers/events/`
- `backend/src/handlers/uploads/`
- `backend/src/repositories/userRepository.js`
- `backend/src/repositories/eventRepository.js`
- `backend/src/repositories/eventStaffRepository.js`
- `backend/src/middleware/authMiddleware.js`
- `backend/src/config/`

#### Key Implementations:
1. **`userRepository.js`:**
   - `createUserWithEmailLock(user)`: Executes `TransactWriteItems` inserting the profile entity (`itemType: PROFILE`) and `EMAIL#<normalizedEmail>` lock item (`itemType: LOCK`) to ensure atomic uniqueness without eventual consistency delay.
   - `findByEmail(email)`: Strongly consistent two-step lookup: reads `EMAIL#<normalizedEmail>` lock item from `MarqueUsers` to obtain `ownerUserId`, then reads the user profile item (`userId: ownerUserId, itemType: PROFILE`). No GSI used.
   - `findById(userId)`: Reads user profile item (`userId: userId, itemType: PROFILE`).
2. **`auth/register.js` & `auth/login.js`:**
   - Hashes passwords with `bcryptjs` (10 rounds).
   - Generates JWT containing `{ userId, email, role }` with 24h expiration.
3. **`eventRepository.js`:**
   - `listPublishedEvents({ category, q })`: Queries `status-startAt-index` with optional filter expression.
   - `getEventById(eventId)`: Fetches event by primary key.
   - `createEvent(eventData, organizerId)`: Initializes event with `confirmedCount: 0` and wraps response in `{ "event": ... }`.
   - `updateEvent(eventId, eventData, organizerId)`: Validates ownership, enforces capacity reduction floor, and wraps response in `{ "event": ... }`.
4. **`eventStaffRepository.js`:**
   - `assignStaff(eventId, email, organizerId)`: Looks up user by email lock. Target user must already exist (returns 400 `USER_NOT_FOUND` if absent). Inserts item into `MarqueEventStaff` with `permission: "CHECK_IN"`.
   - `revokeStaff(eventId, userId)`: Deletes item from `MarqueEventStaff`.
   - `listStaffByEvent(eventId)`: Queries base table `eventId = :id`.
   - `listEventsByStaff(userId)`: Queries `user-assigned-events-index` for `userId = :uid`.
   - `isUserAssigned(eventId, userId)`: $O(1)$ strongly consistent base table lookup.

---

### Scope 2: Preeti's Deliverables

#### Directory Targets:
- `backend/src/handlers/rsvp/`
- `backend/src/handlers/tickets/`
- `backend/src/handlers/checkin/`
- `backend/src/handlers/stats/`
- `backend/src/repositories/rsvpRepository.js`
- `backend/src/repositories/waitlistRepository.js`
- `backend/src/repositories/ticketRepository.js`

#### Key Implementations:
1. **`rsvpRepository.js`:**
   - `reserveSeatAndCreateRsvp(eventId, attendeeId, ticketId)`: Executes `TransactWriteItems` incrementing `confirmedCount` under condition `confirmedCount < capacity`, creating RSVP (`status: CONFIRMED`), and issuing active ticket.
   - `joinWaitlist(eventId, attendeeId, name, email)`: Inserts into `MarqueWaitlist` and creates RSVP (`status: WAITLISTED`, `queueKey: queueKey`).
   - `cancelRsvp(eventId, attendeeId)`: For confirmed RSVPs, cancels ticket and promotes next waitlist candidate. For waitlisted RSVPs, deletes entry from `MarqueWaitlist` directly via `queueKey`.
   - `findRsvpsByAttendee(attendeeId)`: Queries `attendee-index`.
2. **`waitlistRepository.js`:**
   - `MarqueWaitlist` contains active waiting entries only.
   - `addToWaitlist(eventId, attendeeId, name, email)`: Inserts into `MarqueWaitlist` with `queueKey = NOW#attendeeId`.
   - `getOldestWaitingAttendee(eventId)`: Queries base table `PK = eventId` with `ScanIndexForward = true`, `Limit = 1` using **Strongly Consistent Reads** (no status filter required).
   - `promoteWaitlistCandidate(eventId, oldRsvp, candidateQueueKey, candidateUserId, newTicketId)`: Executes atomic multi-item transaction: deletes entry from `MarqueWaitlist` (condition: `attribute_exists(queueKey)`), updates candidate RSVP to `CONFIRMED`, issues new `MarqueTickets` item, and cancels old RSVP without losing seats.
   - `deleteWaitlistEntry(eventId, queueKey)`: Direct base table delete on cancellation.
3. **`ticketRepository.js`:**
   - `getTicketById(ticketId)`: Reads ticket pass for ticket owner only.
   - `searchAttendees(eventId, query, isStaff)`: Queries `event-attendees-index`. Requires `query` (min 2 chars) for coordinators and masks email (`ch***@example.com`).
   - `checkInTicket(eventId, ticketId, staffName)`: Requires explicit staff assignment in `MarqueEventStaff`. Executes atomic conditional update `#status = :checkedIn` WHERE `eventId = :e AND #status = :active`. Catches condition failure to return HTTP 409 `ALREADY_CHECKED_IN`.
4. **`stats/` Handlers:**
   - `getEventStats(eventId)`: Computes capacity, confirmedCount, waitlist length, and checkedInCount for event owner (`ORGANIZER`).
   - `getCheckinSummary(eventId)`: Returns check-in and confirmed counts. Requires explicit staff assignment in `MarqueEventStaff`.

---

## 4. Integration & Handover Checklist

Before submitting code to `main`:
1. [ ] All routes respond with status codes and schemas defined in `docs/openapi.yaml`.
2. [ ] All frontend test suites pass when directed at the local mock or staging API (`npm test --prefix frontend`).
3. [ ] No DynamoDB full-table scans are used in routine request handlers.
4. [ ] No JWTs or sensitive emails are stored in QR ticket payloads.
5. [ ] Passwords stored strictly as bcrypt hashes.
6. [ ] Revoking a coordinator immediately blocks check-in on the subsequent call.
7. [ ] Organizer check-in strictly requires explicit assignment in `MarqueEventStaff`.
