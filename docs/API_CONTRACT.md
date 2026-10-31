# API Contract

Base URL: the deployed API Gateway HTTP API URL. Paths below are relative to that URL.

## Conventions

- JSON request and response bodies unless explicitly stated otherwise.
- Protected requests require standard header: `Authorization: Bearer <JWT>`.
- New accounts created via public registration strictly default to `ATTENDEE`; privileged roles (`ORGANIZER`, `COORDINATOR`) cannot be self-assigned.
- Use ISO 8601 UTC timestamp formatting (e.g. `2026-11-15T09:00:00Z`).
- The backend is the single source of truth for capacities, reservations, and check-in statuses.

## Standard Error Response

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "A short, user-safe explanation."
  }
}
```

Common statuses: `200` Success, `201` Created, `400` Bad Request, `401` Unauthorized (missing/invalid token), `403` Forbidden (insufficient role or unassigned event), `404` Not Found, `409` Conflict (duplicate registration, full capacity, or already checked in), `500` Internal Server Error.

---

## Authentication

### `POST /api/auth/register` — Public
Registers a new campus user. Always defaults to `ATTENDEE`.
- **Request Body:**
  ```json
  {
    "name": "Chandrabhanu Prusty",
    "email": "chandrabhanu@example.com",
    "password": "StrongPassword123!"
  }
  ```
- **Success `201 Created`:**
  ```json
  {
    "token": "<jwt-token>",
    "user": {
      "userId": "usr-attendee-demo",
      "name": "Chandrabhanu Prusty",
      "email": "chandrabhanu@example.com",
      "role": "ATTENDEE"
    }
  }
  ```

### `POST /api/auth/login` — Public
Authenticates credentials against bcrypt hash and issues stateless JWT.
- **Request Body:**
  ```json
  {
    "email": "user@example.com",
    "password": "StrongPassword123!"
  }
  ```
- **Success `200 OK`:**
  ```json
  {
    "token": "<jwt-token>",
    "user": {
      "userId": "usr-id",
      "name": "Full Name",
      "email": "user@example.com",
      "role": "ATTENDEE"
    }
  }
  ```

---

## Events

### `GET /api/events` — Public / Protected
Returns published events list.
- **Query Params:** `q` (text search), `category` (`Technology`, `Workshop`, `Cultural`, `Academic`, `Sports`).
- **Success `200 OK`:**
  ```json
  {
    "events": [
      {
        "eventId": "evt-ccl-hackathon-2026",
        "title": "Cloud Canvas 2026",
        "category": "Technology",
        "startAt": "2026-11-15T09:00:00Z",
        "venue": "Auditorium, VESIT",
        "capacity": 100,
        "confirmedCount": 88,
        "status": "PUBLISHED"
      }
    ]
  }
  ```

### `GET /api/events/{eventId}` — Public / Protected
Returns single event detail with current capacity metrics.

### `POST /api/events` — Organizer Only
Creates a new event owned by the authenticated organizer.
- **Request Body:**
  ```json
  {
    "title": "Cloud Canvas 2026",
    "description": "Hackathon description",
    "category": "Technology",
    "startAt": "2026-11-15T09:00:00Z",
    "endAt": "2026-11-17T17:00:00Z",
    "venue": "Auditorium & Lab 502",
    "capacity": 100,
    "bannerUrl": "https://..."
  }
  ```

### `PATCH /api/events/{eventId}` — Organizer Only (Owner)
Updates event details. Validates `organizerId === user.userId`. Rejects capacity reduction below current `confirmedCount`.

---

## Event Staff & Coordinator Delegation

### `GET /api/events/{eventId}/staff` — Organizer Only (Owner)
Lists all coordinators assigned to this specific event.
- **Success `200 OK`:**
  ```json
  {
    "staff": [
      {
        "eventId": "evt-ccl-hackathon-2026",
        "userId": "usr-coordinator-01",
        "email": "coordinator.preeti@example.com",
        "name": "Preeti Coordinator",
        "role": "COORDINATOR",
        "assignedAt": "2026-10-12T10:00:00Z",
        "assignedBy": "usr-organizer-01"
      }
    ]
  }
  ```

### `POST /api/events/{eventId}/staff` — Organizer Only (Owner)
Assigns a coordinator to this specific event by campus email.
- **Request Body:**
  ```json
  {
    "email": "coordinator.preeti@example.com",
    "role": "COORDINATOR"
  }
  ```
- **Success `201 Created`:** Returns created `MarqueEventStaff` record.
- **Errors:** `400 INVALID_EMAIL`, `403 FORBIDDEN` (not event owner), `409 ALREADY_ASSIGNED`.

### `DELETE /api/events/{eventId}/staff/{userId}` — Organizer Only (Owner)
Revokes coordinator check-in authorization for this specific event.
- **Success `200 OK`:** `{ "message": "Coordinator removed successfully." }`

### `GET /api/me/assigned-events` — Coordinator / Organizer
Returns only the events that the authenticated user is authorized to check in (either through assignment in `MarqueEventStaff` or event ownership).
- **Success `200 OK`:**
  ```json
  {
    "events": [
      {
        "eventId": "evt-ccl-hackathon-2026",
        "title": "Cloud Canvas 2026: Campus Hackathon",
        "venue": "Auditorium & Lab 502, VESIT Campus",
        "confirmedCount": 88
      }
    ]
  }
  ```

---

## RSVP, Waitlist & Tickets

### `POST /api/events/{eventId}/rsvp` — Attendee
Registers user for event.
- **Capacity Available:** Returns `{ "status": "CONFIRMED", "rsvpId": "rsvp-...", "ticketId": "tkt-..." }`.
- **Capacity Full:** Returns `{ "status": "WAITLISTED", "rsvpId": "rsvp-...", "queuePosition": 1 }`.
- **Duplicate Registration:** Returns `409 Conflict` (`DUPLICATE_REGISTRATION`).

### `DELETE /api/events/{eventId}/rsvp` — Attendee
Cancels active registration. If confirmed, automatically triggers FIFO promotion of the earliest waitlisted participant.

### `GET /api/me/rsvps` — Attendee
Returns the caller's registrations with statuses (`CONFIRMED`, `WAITLISTED`, `CANCELLED`), waitlist queue positions, and opaque ticket IDs.

### `GET /api/tickets/{ticketId}` — Ticket Owner / Assigned Staff
Returns ticket details. Attendees can only view their own tickets; staff can inspect tickets belonging to their assigned events.

---

## Venue Check-in & Attendees

### `GET /api/events/{eventId}/attendees?q={query}` — Assigned Staff / Event Owner
Search attendees by name, email, or ticket code.
- **Enforcement:** Caller must be event owner OR listed in `MarqueEventStaff` for this `eventId`. Unauthorized users receive `403 Forbidden`.

### `POST /api/events/{eventId}/check-in` — Assigned Staff / Event Owner
Processes single-use check-in for an attendee ticket.
- **Request Body:**
  ```json
  {
    "ticketId": "tkt-8f3a9e1b2c4d"
  }
  ```
- **Validation Rules:**
  1. Caller must have check-in permissions for this `eventId` (`MarqueEventStaff` or event owner). Attendees are rejected with `403 FORBIDDEN`.
  2. Ticket must exist and belong to `eventId`.
  3. Ticket status must be `ACTIVE`.
  4. If status is `CHECKED_IN`, returns `409 Conflict` (`ALREADY_CHECKED_IN`).
- **Success `200 OK`:**
  ```json
  {
    "status": "CHECKED_IN",
    "ticketId": "tkt-8f3a9e1b2c4d",
    "attendeeName": "Chandrabhanu Prusty",
    "attendeeEmail": "chandrabhanu@example.com",
    "checkedInAt": "2026-11-15T09:15:00Z",
    "checkedInBy": "Preeti Coordinator"
  }
  ```

### `GET /api/events/{eventId}/stats` — Event Owner Only
Returns live attendance turnout metrics: `capacity`, `confirmedCount`, `waitlistCount`, `checkedInCount`, `attendancePercentage`.
