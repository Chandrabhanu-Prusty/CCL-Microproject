# DynamoDB Database Design — Final & Frozen Schema

This document specifies the exact logical and physical data model for Marque on Amazon DynamoDB. It details tables, primary keys, Global Secondary Indexes (GSIs), projection types, access patterns, strongly consistent queries, conditional writes, and multi-item ACID transactions.

---

## 1. Table Architecture Summary

| Table Name | Partition Key (PK) | Sort Key (SK) | Billing Mode | Purpose |
| :--- | :--- | :--- | :--- | :--- |
| `MarqueUsers` | `userId` (S) | `itemType` (S) | On-Demand | User profiles, bcrypt credentials, and atomic email lock records |
| `MarqueEvents` | `eventId` (S) | — | On-Demand | Campus events, schedules, capacity tallies, and organizer ownership |
| `MarqueEventStaff` | `eventId` (S) | `userId` (S) | On-Demand | Event-scoped check-in staff delegations and instant revocations |
| `MarqueRSVPs` | `eventId` (S) | `attendeeId` (S) | On-Demand | Participant registration state machine (`CONFIRMED`, `WAITLISTED`, `CANCELLED`) |
| `MarqueWaitlist` | `eventId` (S) | `queueKey` (S) | On-Demand | FIFO queue with **strongly consistent** chronological ordering |
| `MarqueTickets` | `ticketId` (S) | — | On-Demand | Opaque single-use passes and check-in audit logs |

---

## 2. Table Schemas & Specifications

### 2.1 `MarqueUsers`
Stores user profile credentials and houses atomic transactional email uniqueness locks.
- **Partition Key (`PK`):** `userId` (String, e.g. `usr-8f3a9e1b2c4d` or `EMAIL#<normalizedEmail>`)
- **Sort Key (`SK`):** `itemType` (String: `PROFILE` for user entities, `LOCK` for email uniqueness locks)
- **Attributes (for `itemType = "PROFILE"`):**
  - `userId`: String (Unique user identifier)
  - `itemType`: String (`PROFILE`)
  - `name`: String (User's display name)
  - `email`: String (User's display email)
  - `normalizedEmail`: String (Lowercase, trimmed email)
  - `passwordHash`: String (bcrypt hash, 10 rounds)
  - `role`: String (`ATTENDEE` | `ORGANIZER`) — *Note: Global roles only*
  - `createdAt`: String (ISO 8601 UTC)
  - `updatedAt`: String (ISO 8601 UTC)
- **Attributes (for `itemType = "LOCK"`):**
  - `userId`: String (`EMAIL#<normalizedEmail>`)
  - `itemType`: String (`LOCK`)
  - `ownerUserId`: String (Points to `usr-xxx`)
  - `createdAt`: String (ISO 8601 UTC)
- **GSI `email-index`:**
  - Partition Key: `normalizedEmail` (String)
  - Sort Key: `itemType` (String)
  - Projection: `ALL`
  - Usage: Lookup during user sign-in and coordinator assignment.

---

### 2.2 `MarqueEvents`
Stores all campus event listings, capacity allocations, and live attendance metrics.
- **Partition Key (`PK`):** `eventId` (String, e.g. `evt-ccl-hackathon-2026`)
- **Sort Key (`SK`):** None (Simple primary key)
- **Attributes:**
  - `eventId`: String (Unique event identifier)
  - `title`: String (Event title)
  - `description`: String (Markdown/plain text description)
  - `category`: String (`Technology`, `Workshop`, `Cultural`, `Academic`, `Sports`)
  - `startAt`: String (ISO 8601 UTC)
  - `endAt`: String (ISO 8601 UTC, optional)
  - `venue`: String (Campus location/room)
  - `capacity`: Number (Max allowed confirmed seats)
  - `confirmedCount`: Number (Current active confirmed attendee count, $\le$ `capacity`)
  - `status`: String (`PUBLISHED` | `DRAFT` | `CANCELLED`)
  - `organizerId`: String (`userId` of the event owner)
  - `bannerUrl`: String (S3 URL, optional)
  - `createdAt`: String (ISO 8601 UTC)
  - `updatedAt`: String (ISO 8601 UTC)
- **GSI `status-startAt-index`:**
  - Partition Key: `status` (String)
  - Sort Key: `startAt` (String)
  - Projection: `ALL`
  - Usage: Public event discovery, date filtering, and upcoming schedules.
- **GSI `organizer-index`:**
  - Partition Key: `organizerId` (String)
  - Sort Key: `createdAt` (String)
  - Projection: `ALL`
  - Usage: Organizer dashboard listing events owned by the user.

---

### 2.3 `MarqueEventStaff`
Stores event-specific coordinator delegations. Authorizes users to perform check-in operations without elevating their global account role.
- **Partition Key (`PK`):** `eventId` (String)
- **Sort Key (`SK`):** `userId` (String)
- **Attributes:**
  - `eventId`: String (Target event ID)
  - `userId`: String (Delegated coordinator user ID)
  - `email`: String (Coordinator's normalized campus email)
  - `name`: String (Coordinator's display name)
  - `permission`: String (`CHECK_IN`)
  - `assignedAt`: String (ISO 8601 UTC)
  - `assignedBy`: String (`userId` of the event organizer)
- **GSI `user-assigned-events-index`:**
  - Partition Key: `userId` (String)
  - Sort Key: `assignedAt` (String)
  - Projection: `ALL`
  - Usage: Powers `GET /api/me/assigned-events` in $O(1)$ query time.

---

### 2.4 `MarqueRSVPs`
Manages attendee registration state per event. Composite key guarantees at most one active registration per attendee per event.
- **Partition Key (`PK`):** `eventId` (String)
- **Sort Key (`SK`):** `attendeeId` (String)
- **Attributes:**
  - `eventId`: String (Target event)
  - `attendeeId`: String (Attendee user ID)
  - `rsvpId`: String (Unique registration ID, e.g. `rsvp-xxx`)
  - `status`: String (`CONFIRMED` | `WAITLISTED` | `CANCELLED`)
  - `ticketId`: String (Nullable, present only if `status = "CONFIRMED"`)
  - `createdAt`: String (ISO 8601 UTC)
  - `updatedAt`: String (ISO 8601 UTC)
- **GSI `attendee-index`:**
  - Partition Key: `attendeeId` (String)
  - Sort Key: `createdAt` (String)
  - Projection: `ALL`
  - Usage: Powers **My RSVPs** (`GET /api/me/rsvps`).

---

### 2.5 `MarqueWaitlist`
Maintains the FIFO waiting queue for full events. Base table layout ensures **strongly consistent chronological queries** during seat reclamation.
- **Partition Key (`PK`):** `eventId` (String)
- **Sort Key (`SK`):** `queueKey` (String: `<ISO8601_TIMESTAMP>#<attendeeId>`)
- **Attributes:**
  - `eventId`: String (Target event)
  - `queueKey`: String (Chronological sort key)
  - `attendeeId`: String (User ID of the waitlisted attendee)
  - `attendeeName`: String (Cached name for promotion log)
  - `attendeeEmail`: String (Cached email)
  - `status`: String (`WAITING` | `PROMOTED` | `CANCELLED`)
  - `createdAt`: String (ISO 8601 UTC)
  - `updatedAt`: String (ISO 8601 UTC)
- **GSI `attendee-waitlist-index`:**
  - Partition Key: `attendeeId` (String)
  - Sort Key: `eventId` (String)
  - Projection: `ALL`
  - Usage: Locates a user's active waitlist entry during self-cancellation.

---

### 2.6 `MarqueTickets`
Stores single-use opaque digital passes. Contains strictly no JWTs, passwords, or sensitive credentials.
- **Partition Key (`PK`):** `ticketId` (String: Opaque random string, e.g. `tkt-8f3a9e1b2c4d`)
- **Sort Key (`SK`):** None (Simple primary key)
- **Attributes:**
  - `ticketId`: String (Opaque identifier encoded in the QR SVG)
  - `eventId`: String (Associated event)
  - `attendeeId`: String (Ticket owner user ID)
  - `attendeeName`: String (Display name)
  - `attendeeEmail`: String (Display email)
  - `eventTitle`: String (Cached event title)
  - `eventVenue`: String (Cached venue)
  - `eventStartAt`: String (Cached start time)
  - `status`: String (`ACTIVE` | `CHECKED_IN` | `CANCELLED`)
  - `issuedAt`: String (ISO 8601 UTC)
  - `checkedInAt`: String (Nullable, timestamp of admission)
  - `checkedInBy`: String (Nullable, name/ID of check-in staff)
- **GSI `event-attendees-index`:**
  - Partition Key: `eventId` (String)
  - Sort Key: `attendeeName` (String)
  - Projection: `ALL`
  - Usage: Powers attendee registry lookups for venue coordinators (`GET /api/events/{eventId}/attendees`).
- **GSI `attendee-tickets-index`:**
  - Partition Key: `attendeeId` (String)
  - Sort Key: `eventId` (String)
  - Projection: `ALL`
  - Usage: Powers ticket inspection by ticket owners.

---

## 3. Comprehensive Access Patterns & Query Matrix

| Pattern ID | Access Pattern Description | Target Table / GSI | Key Condition Expression | Filter Expression / Projection | Consistency Model |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **AP-01** | Find user by normalized email (Login / Assign) | `MarqueUsers` (`email-index`) | `normalizedEmail = :email AND itemType = :profile` | None (Projection: ALL) | Eventually Consistent |
| **AP-02** | Get user profile by userId | `MarqueUsers` | `userId = :userId AND itemType = 'PROFILE'` | None | Strongly Consistent |
| **AP-03** | List published upcoming events | `MarqueEvents` (`status-startAt-index`) | `status = 'PUBLISHED' AND startAt >= :now` | Optional category filter | Eventually Consistent |
| **AP-04** | Get single event details | `MarqueEvents` | `eventId = :eventId` | None | Strongly Consistent |
| **AP-05** | List events owned by organizer | `MarqueEvents` (`organizer-index`) | `organizerId = :userId` | None | Eventually Consistent |
| **AP-06** | List coordinators assigned to event | `MarqueEventStaff` | `eventId = :eventId` | None | Strongly Consistent |
| **AP-07** | Verify if user is assigned check-in staff | `MarqueEventStaff` | `eventId = :eventId AND userId = :userId` | None | Strongly Consistent |
| **AP-08** | List events assigned to coordinator | `MarqueEventStaff` (`user-assigned-events-index`) | `userId = :userId` | None | Eventually Consistent |
| **AP-09** | List attendee's registrations (My RSVPs) | `MarqueRSVPs` (`attendee-index`) | `attendeeId = :userId` | None | Eventually Consistent |
| **AP-10** | Get attendee's specific event RSVP | `MarqueRSVPs` | `eventId = :eventId AND attendeeId = :userId` | None | Strongly Consistent |
| **AP-11** | Retrieve oldest waitlisted attendee (FIFO) | `MarqueWaitlist` (Base Table) | `eventId = :eventId` (`ScanIndexForward = true`, `Limit = 1`) | `status = 'WAITING'` | **Strongly Consistent** |
| **AP-12** | Get ticket by opaque ID | `MarqueTickets` | `ticketId = :ticketId` | None | Strongly Consistent |
| **AP-13** | Search attendees for check-in | `MarqueTickets` (`event-attendees-index`) | `eventId = :eventId` | `begins_with(attendeeName, :q) OR contains(attendeeEmail, :q) OR ticketId = :q` | Eventually Consistent |

---

## 4. Concurrency & Transaction Boundaries

### 4.1 Atomic Email Registration (`POST /api/auth/register`)
To eliminate the eventual-consistency race condition of GSIs, user registration utilizes an atomic DynamoDB transaction writing both the profile entity and a unique lock record:

```json
{
  "TransactItems": [
    {
      "Put": {
        "TableName": "MarqueUsers",
        "Item": {
          "userId": { "S": "usr-8f3a9e1b2c4d" },
          "itemType": { "S": "PROFILE" },
          "name": { "S": "Chandrabhanu Prusty" },
          "email": { "S": "chandrabhanu@example.com" },
          "normalizedEmail": { "S": "chandrabhanu@example.com" },
          "passwordHash": { "S": "$2a$10$..." },
          "role": { "S": "ATTENDEE" },
          "createdAt": { "S": "2026-10-31T12:00:00.000Z" }
        },
        "ConditionExpression": "attribute_not_exists(userId)"
      }
    },
    {
      "Put": {
        "TableName": "MarqueUsers",
        "Item": {
          "userId": { "S": "EMAIL#chandrabhanu@example.com" },
          "itemType": { "S": "LOCK" },
          "ownerUserId": { "S": "usr-8f3a9e1b2c4d" },
          "createdAt": { "S": "2026-10-31T12:00:00.000Z" }
        },
        "ConditionExpression": "attribute_not_exists(userId)"
      }
    }
  ]
}
```
*Outcome:* If two users concurrently submit registrations with the same email, exactly one transaction succeeds; the second fails atomically with `TransactionCanceledException` and returns HTTP 409 `EMAIL_ALREADY_EXISTS`.

---

### 4.2 Capacity-Safe RSVP & Final-Seat Booking (`POST /api/events/{eventId}/rsvp`)
To guarantee that `confirmedCount` never exceeds `capacity` under concurrent requests:

```json
{
  "TransactItems": [
    {
      "Update": {
        "TableName": "MarqueEvents",
        "Key": { "eventId": { "S": "evt-ccl-hackathon-2026" } },
        "UpdateExpression": "SET confirmedCount = confirmedCount + :inc",
        "ConditionExpression": "confirmedCount < capacity AND #status = :published",
        "ExpressionAttributeNames": { "#status": "status" },
        "ExpressionAttributeValues": {
          ":inc": { "N": "1" },
          ":published": { "S": "PUBLISHED" }
        }
      }
    },
    {
      "Put": {
        "TableName": "MarqueRSVPs",
        "Item": {
          "eventId": { "S": "evt-ccl-hackathon-2026" },
          "attendeeId": { "S": "usr-attendee-01" },
          "rsvpId": { "S": "rsvp-9a8b7c6d" },
          "status": { "S": "CONFIRMED" },
          "ticketId": { "S": "tkt-8f3a9e1b2c4d" },
          "createdAt": { "S": "2026-10-31T12:00:00.000Z" }
        },
        "ConditionExpression": "attribute_not_exists(attendeeId) OR #status = :cancelled",
        "ExpressionAttributeNames": { "#status": "status" },
        "ExpressionAttributeValues": { ":cancelled": { "S": "CANCELLED" } }
      }
    },
    {
      "Put": {
        "TableName": "MarqueTickets",
        "Item": {
          "ticketId": { "S": "tkt-8f3a9e1b2c4d" },
          "eventId": { "S": "evt-ccl-hackathon-2026" },
          "attendeeId": { "S": "usr-attendee-01" },
          "attendeeName": { "S": "Chandrabhanu Prusty" },
          "attendeeEmail": { "S": "chandrabhanu@example.com" },
          "status": { "S": "ACTIVE" },
          "issuedAt": { "S": "2026-10-31T12:00:00.000Z" }
        },
        "ConditionExpression": "attribute_not_exists(ticketId)"
      }
    }
  ]
}
```
*Concurrency Guarantee:* If 50 users contest the last available seat, exactly 1 update succeeds on `MarqueEvents`. The remaining 49 transactions are cancelled due to condition failure (`confirmedCount < capacity`). The backend catches this condition and safely routes them to the waitlist.

---

### 4.3 Cancellation & Deterministic FIFO Promotion (`DELETE /api/events/{eventId}/rsvp`)
1. Query `MarqueWaitlist` on the base table partition `eventId` with `ScanIndexForward = true` and `Limit = 1` using **Strongly Consistent Reads**.
2. **If a waitlisted user (`usr-waitlist-01`) exists:**
   ```json
   {
     "TransactItems": [
       {
         "Update": {
           "TableName": "MarqueRSVPs",
           "Key": {
             "eventId": { "S": "evt-ccl-hackathon-2026" },
             "attendeeId": { "S": "usr-cancelling-attendee" }
           },
           "UpdateExpression": "SET #status = :cancelled, updatedAt = :now",
           "ConditionExpression": "#status = :confirmed",
           "ExpressionAttributeNames": { "#status": "status" },
           "ExpressionAttributeValues": {
             ":cancelled": { "S": "CANCELLED" },
             ":confirmed": { "S": "CONFIRMED" },
             ":now": { "S": "2026-10-31T12:05:00.000Z" }
           }
         }
       },
       {
         "Update": {
           "TableName": "MarqueTickets",
           "Key": { "ticketId": { "S": "tkt-old-ticket-id" } },
           "UpdateExpression": "SET #status = :cancelled",
           "ConditionExpression": "#status = :active",
           "ExpressionAttributeNames": { "#status": "status" },
           "ExpressionAttributeValues": {
             ":cancelled": { "S": "CANCELLED" },
             ":active": { "S": "ACTIVE" }
           }
         }
       },
       {
         "Update": {
           "TableName": "MarqueWaitlist",
           "Key": {
             "eventId": { "S": "evt-ccl-hackathon-2026" },
             "queueKey": { "S": "2026-10-19T14:30:00.000Z#usr-waitlist-01" }
           },
           "UpdateExpression": "SET #status = :promoted, updatedAt = :now",
           "ConditionExpression": "#status = :waiting",
           "ExpressionAttributeNames": { "#status": "status" },
           "ExpressionAttributeValues": {
             ":promoted": { "S": "PROMOTED" },
             ":waiting": { "S": "WAITING" },
             ":now": { "S": "2026-10-31T12:05:00.000Z" }
           }
         }
       },
       {
         "Update": {
           "TableName": "MarqueRSVPs",
           "Key": {
             "eventId": { "S": "evt-ccl-hackathon-2026" },
             "attendeeId": { "S": "usr-waitlist-01" }
           },
           "UpdateExpression": "SET #status = :confirmed, ticketId = :newTicketId, updatedAt = :now",
           "ConditionExpression": "#status = :waitlisted",
           "ExpressionAttributeNames": { "#status": "status" },
           "ExpressionAttributeValues": {
             ":confirmed": { "S": "CONFIRMED" },
             ":waitlisted": { "S": "WAITLISTED" },
             ":newTicketId": { "S": "tkt-newly-promoted" },
             ":now": { "S": "2026-10-31T12:05:00.000Z" }
           }
         }
       },
       {
         "Put": {
           "TableName": "MarqueTickets",
           "Item": {
             "ticketId": { "S": "tkt-newly-promoted" },
             "eventId": { "S": "evt-ccl-hackathon-2026" },
             "attendeeId": { "S": "usr-waitlist-01" },
             "attendeeName": { "S": "Aarav Sharma" },
             "attendeeEmail": { "S": "aarav.sharma@example.com" },
             "status": { "S": "ACTIVE" },
             "issuedAt": { "S": "2026-10-31T12:05:00.000Z" }
           },
           "ConditionExpression": "attribute_not_exists(ticketId)"
         }
       }
     ]
   }
   ```
   *Double-Promotion Prevention:* Notice condition `#status = :waiting` on `MarqueWaitlist`. If two cancellations occur simultaneously, both query the same top waitlist candidate, but only one transaction can successfully change status from `WAITING` to `PROMOTED`. The conflicting transaction fails, safely retries, queries the *second* candidate in line, and promotes them.
3. **If waitlist is empty:**
   The transaction cancels the RSVP/ticket and atomically decrements `MarqueEvents.confirmedCount` with condition `confirmedCount > 0`.

---

### 4.4 Atomic Single-Use Venue Check-In (`POST /api/events/{eventId}/check-in`)
Check-in operations enforce caller authorization against `MarqueEventStaff`, verify ticket eligibility, and atomically update status:

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
    ":eventId": { "S": "evt-ccl-hackathon-2026" },
    ":now": { "S": "2026-11-15T09:15:00.000Z" },
    ":staffName": { "S": "Preeti Coordinator" }
  }
}
```
*Idempotency & Race Condition Guard:* If an attendee presents a cloned or duplicate QR code at two different entrance lanes simultaneously, only the first request succeeds. The second execution fails the condition `#status = :active`, detects `#status = 'CHECKED_IN'`, and returns HTTP 409 `ALREADY_CHECKED_IN` containing the exact prior check-in timestamp and coordinator name.
