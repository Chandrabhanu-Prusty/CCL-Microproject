# DynamoDB Data Design

This is the logical data model. Table names can be adjusted only if the code and documentation are updated together.

## 1. Tables

### `MarqueUsers`
- Partition key: `userId` (String)
- Attributes: `name`, `normalizedEmail`, `passwordHash`, `role`, `createdAt`
- GSI `email-index`: partition key `normalizedEmail`
- Roles: `ATTENDEE`, `ORGANIZER`, `COORDINATOR`. Never store plaintext passwords.

### `MarqueEvents`
- Partition key: `eventId` (String)
- Attributes: `title`, `description`, `category`, `startAt`, `endAt`, `venue`, `capacity`, `confirmedCount`, `status`, `organizerId`, `bannerUrl`, `createdAt`, `updatedAt`
- GSI `status-startAt-index`: partition key `status`, sort key `startAt`
- `confirmedCount` changes only through backend transactions/conditional writes.

### `MarqueRSVPs`
- Partition key: `eventId` (String); sort key: `attendeeId` (String)
- Attributes: `rsvpId`, `status`, `createdAt`, `updatedAt`, `ticketId`
- GSI `attendee-index`: partition key `attendeeId`, sort key `createdAt`
- `eventId + attendeeId` prevents duplicate RSVP records for the same attendee/event.
- Statuses: `CONFIRMED`, `WAITLISTED`, `CANCELLED`.

### `MarqueWaitlist`
- Partition key: `eventId` (String); sort key: `attendeeId` (String)
- Attributes: `queueKey`, `status`, `createdAt`, `updatedAt`
- GSI `event-queue-index`: partition key `eventId`, sort key `queueKey`
- `queueKey` sorts by creation time then attendee ID, e.g. ISO timestamp plus `#attendeeId`.
- Statuses: `WAITING`, `PROMOTED`, `CANCELLED`.

### `MarqueTickets`
- Partition key: `ticketId` (String, random opaque ID)
- Attributes: `eventId`, `attendeeId`, `status`, `issuedAt`, `checkedInAt`, `checkedInBy`
- GSI `event-index`: partition key `eventId`, sort key `attendeeId`
- GSI `attendee-index`: partition key `attendeeId`, sort key `eventId`
- Statuses: `ACTIVE`, `CANCELLED`, `CHECKED_IN`.

## 2. Required access patterns

- Find a user by normalized email during login; get profile by `userId`.
- List published events by status/start time; get an event by ID.
- List RSVP records for an event; list a user's registrations.
- Find the oldest waiting entry for an event.
- Get a ticket by opaque ticket ID; list tickets/attendance for an event.

Use `Query` for known partition keys and indexes. Avoid table scans for routine user-facing flows.

## 3. Capacity-safe RSVP

The backend, not the frontend, controls capacity:
1. Validate user, event, registration window, and duplicate state.
2. Attempt a DynamoDB transaction that increments `confirmedCount` only when `confirmedCount < capacity` and the event is open.
3. In the same transaction, create/update the RSVP as `CONFIRMED` and create a unique active ticket.
4. If the transaction fails specifically because capacity is full, create a `WAITLISTED` RSVP and waitlist item using conditional writes.
5. If a duplicate or another conflict caused failure, return the existing state or a suitable conflict response. Do not treat every transaction failure as “event full.”

## 4. Cancellation and promotion

1. Verify the current user owns the RSVP or has authorized staff permissions.
2. Query the oldest `WAITING` entry using `event-queue-index`.
3. If a valid waitlisted attendee exists, use a transaction to cancel the original RSVP/ticket, promote the selected RSVP, update the waitlist entry, and issue/activate the promoted ticket. Require the selected entry still be `WAITING`.
4. If the transaction conflicts, retry the query/promotion flow a limited number of times.
5. If no eligible waitlisted attendee exists, transactionally cancel the RSVP/ticket and decrement `confirmedCount`.
6. Avoid separate unprotected decrement/increment operations that can create inconsistent capacity.

## 5. Single-use check-in

Use a conditional ticket update requiring `status = ACTIVE` and a matching `eventId`. Set `status = CHECKED_IN`, `checkedInAt`, and `checkedInBy` in one operation. If the condition fails, return an appropriate invalid/already-checked-in result.

## 6. Implementation note

Review exact access patterns before creating production data. The logical schema may need adjustments to fit DynamoDB transaction limits and actual indexes. Keep the schema simple, use stable IDs, and test concurrent booking and repeated check-in.
