# DynamoDB Data Design

This document details the logical data model for Marque, including table structures, partition/sort keys, Global Secondary Indexes (GSIs), access patterns, and ACID conditional transactions.

## 1. Tables Overview

| Table Name | Partition Key | Sort Key | Purpose |
| :--- | :--- | :--- | :--- |
| `MarqueUsers` | `userId` (S) | — | User accounts, credentials, and global system roles |
| `MarqueEvents` | `eventId` (S) | — | Campus event details, schedules, capacities, and tallies |
| `MarqueEventStaff` | `eventId` (S) | `userId` (S) | **Event-scoped coordinator delegations and permissions** |
| `MarqueRSVPs` | `eventId` (S) | `attendeeId` (S) | Individual event registration records & state machine |
| `MarqueWaitlist` | `eventId` (S) | `attendeeId` (S) | Chronological FIFO queue entries for full events |
| `MarqueTickets` | `ticketId` (S) | — | Opaque digital passes and single-use check-in logs |

---

## 2. Table Specifications

### `MarqueUsers`
- **Partition key:** `userId` (String, UUID or `usr-xxx`)
- **Attributes:** `name`, `normalizedEmail`, `passwordHash` (bcrypt), `role` (`ATTENDEE` | `ORGANIZER` | `COORDINATOR`), `createdAt`
- **GSI `email-index`:**
  - Partition key: `normalizedEmail` (String)
  - Projection: `ALL`
  - Usage: Lookup during authentication and coordinator email assignment.

### `MarqueEvents`
- **Partition key:** `eventId` (String, `evt-xxx`)
- **Attributes:** `title`, `description`, `category`, `startAt`, `endAt`, `venue`, `capacity` (Number), `confirmedCount` (Number), `status` (`DRAFT` | `PUBLISHED` | `CANCELLED`), `organizerId` (String), `bannerUrl` (String), `createdAt`, `updatedAt`
- **GSI `status-startAt-index`:**
  - Partition key: `status` (String)
  - Sort key: `startAt` (String, ISO 8601)
  - Usage: Public event discovery and date sorting.
- **GSI `organizer-index`:**
  - Partition key: `organizerId` (String)
  - Sort key: `createdAt` (String)
  - Usage: Listing events owned by a specific organizer.

### `MarqueEventStaff` (New: Event-Scoped RBAC Table)
Links events to authorized check-in staff. Ensures coordinators only access events they are delegated to.
- **Partition key:** `eventId` (String)
- **Sort key:** `userId` (String)
- **Attributes:** `email` (String), `name` (String), `role` (`COORDINATOR`), `assignedAt` (String, ISO 8601), `assignedBy` (String, organizer `userId`)
- **GSI `user-assigned-events-index`:**
  - Partition key: `userId` (String)
  - Sort key: `assignedAt` (String)
  - Usage: Querying all events assigned to a specific coordinator (`GET /api/me/assigned-events`).

### `MarqueRSVPs`
- **Partition key:** `eventId` (String)
- **Sort key:** `attendeeId` (String)
- **Attributes:** `rsvpId` (String), `status` (`CONFIRMED` | `WAITLISTED` | `CANCELLED`), `ticketId` (String, nullable), `createdAt`, `updatedAt`
- **GSI `attendee-index`:**
  - Partition key: `attendeeId` (String)
  - Sort key: `createdAt` (String)
  - Usage: Powering attendee **My RSVPs** (`GET /api/me/rsvps`).
- *Note:* The composite key `eventId + attendeeId` strictly guarantees that an attendee can only hold one RSVP record per event.

### `MarqueWaitlist`
- **Partition key:** `eventId` (String)
- **Sort key:** `attendeeId` (String)
- **Attributes:** `queueKey` (String: `ISO_TIMESTAMP#attendeeId`), `status` (`WAITING` | `PROMOTED` | `CANCELLED`), `createdAt`, `updatedAt`
- **GSI `event-queue-index`:**
  - Partition key: `eventId` (String)
  - Sort key: `queueKey` (String)
  - Usage: Retrieving the oldest waiting attendee in strict FIFO order during ticket cancellation.

### `MarqueTickets`
- **Partition key:** `ticketId` (String: random opaque identifier `tkt-xxxxxxxx`)
- **Attributes:** `eventId` (String), `attendeeId` (String), `attendeeName` (String), `attendeeEmail` (String), `status` (`ACTIVE` | `CANCELLED` | `CHECKED_IN`), `issuedAt` (String), `checkedInAt` (String, nullable), `checkedInBy` (String, nullable)
- **GSI `event-index`:**
  - Partition key: `eventId` (String)
  - Sort key: `attendeeId` (String)
  - Usage: Querying attendee registry for check-in staff (`GET /api/events/{eventId}/attendees`).
- **GSI `attendee-index`:**
  - Partition key: `attendeeId` (String)
  - Sort key: `eventId` (String)
  - Usage: Retrieving active tickets for pass rendering.

---

## 3. Required Access Patterns & Query Strategy

| ID | Access Pattern | Target Table / Index | Key Condition |
| :--- | :--- | :--- | :--- |
| **AP-01** | Find user by normalized email | `MarqueUsers` (`email-index`) | `normalizedEmail = :email` |
| **AP-02** | List published events chronologically | `MarqueEvents` (`status-startAt-index`) | `status = 'PUBLISHED' AND startAt >= :now` |
| **AP-03** | List events owned by organizer | `MarqueEvents` (`organizer-index`) | `organizerId = :userId` |
| **AP-04** | List coordinators assigned to event | `MarqueEventStaff` | `eventId = :eventId` |
| **AP-05** | Check if coordinator is assigned | `MarqueEventStaff` | `eventId = :eventId AND userId = :userId` |
| **AP-06** | List events assigned to coordinator | `MarqueEventStaff` (`user-assigned-events-index`) | `userId = :userId` |
| **AP-07** | List attendee's RSVPs | `MarqueRSVPs` (`attendee-index`) | `attendeeId = :userId` |
| **AP-08** | Get next eligible waitlisted attendee | `MarqueWaitlist` (`event-queue-index`) | `eventId = :eventId`, `ScanIndexForward = true`, `Limit = 1` |
| **AP-09** | Get ticket by opaque ID | `MarqueTickets` | `ticketId = :ticketId` |
| **AP-10** | Search event attendee registry | `MarqueTickets` (`event-index`) | `eventId = :eventId` |

---

## 4. Capacity-Safe RSVP & Waitlist Transaction

The backend controls capacity using DynamoDB atomic transactions (`TransactWriteItems`):

1. **Validation:** Check user authentication, event publish state, and existing active RSVP.
2. **Conditional Capacity Reservation:**
   ```json
   {
     "Update": {
       "TableName": "MarqueEvents",
       "Key": { "eventId": { "S": "evt-123" } },
       "UpdateExpression": "SET confirmedCount = confirmedCount + :inc",
       "ConditionExpression": "confirmedCount < capacity AND #status = :published",
       "ExpressionAttributeNames": { "#status": "status" },
       "ExpressionAttributeValues": { ":inc": { "N": "1" }, ":published": { "S": "PUBLISHED" } }
     }
   }
   ```
3. In the same transaction:
   - `Put` into `MarqueRSVPs` with `status = 'CONFIRMED'` and generated `ticketId`.
   - `Put` into `MarqueTickets` with `status = 'ACTIVE'`.
4. If the transaction fails with `TransactionCanceledException` due to capacity condition:
   - Execute conditional write into `MarqueWaitlist` with `queueKey = NOW#userId` and `status = 'WAITING'`.
   - Record `MarqueRSVPs` with `status = 'WAITLISTED'`.

---

## 5. Cancellation & Automatic FIFO Promotion Flow

1. Authenticate that user owns the RSVP.
2. Query `MarqueWaitlist` on `event-queue-index` for `eventId = :id` with `ScanIndexForward = true` (FIFO) and filter `status = 'WAITING'` (Limit 1).
3. **If eligible waitlisted candidate exists:**
   - Execute atomic `TransactWriteItems`:
     - Update original RSVP to `status = 'CANCELLED'`.
     - Update original ticket to `status = 'CANCELLED'`.
     - Update promoted user's `MarqueWaitlist` record to `status = 'PROMOTED'`.
     - Update promoted user's `MarqueRSVPs` record to `status = 'CONFIRMED'` with new `ticketId`.
     - `Put` new active ticket in `MarqueTickets`.
     - *Confirmed capacity remains unchanged.*
4. **If waitlist is empty:**
   - Execute atomic `TransactWriteItems`:
     - Update original RSVP to `status = 'CANCELLED'`.
     - Update original ticket to `status = 'CANCELLED'`.
     - Decrement `MarqueEvents.confirmedCount` by 1 with condition `confirmedCount > 0`.

---

## 6. Single-Use Check-In Operation

The check-in handler strictly enforces authorization and idempotency:

1. **Authorization Check:** Query `MarqueEventStaff` for `eventId` and `user.userId` (or verify `MarqueEvents.organizerId === user.userId`). If not found, reject with `403 FORBIDDEN`.
2. **Atomic State Transition:**
   ```json
   {
     "TableName": "MarqueTickets",
     "Key": { "ticketId": { "S": "tkt-8f3a9e1b2c4d" } },
     "UpdateExpression": "SET #status = :checkedIn, checkedInAt = :now, checkedInBy = :staffName",
     "ConditionExpression": "eventId = :eventId AND #status = :active",
     "ExpressionAttributeNames": { "#status": "status" },
     "ExpressionAttributeValues": {
       ":checkedIn": { "S": "CHECKED_IN" },
       ":active": { "S": "ACTIVE" },
       ":eventId": { "S": "evt-123" },
       ":now": { "S": "2026-11-15T09:15:00Z" },
       ":staffName": { "S": "Preeti Coordinator" }
     }
   }
   ```
3. If condition fails because `#status = 'CHECKED_IN'`, return user-friendly `409 Conflict` (`ALREADY_CHECKED_IN`) with original check-in timestamp and coordinator name.
