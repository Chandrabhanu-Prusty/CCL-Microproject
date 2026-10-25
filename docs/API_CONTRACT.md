# API Contract

Base URL: the deployed API Gateway HTTP API URL. Paths below are relative to that URL.

## Conventions

- JSON request/response bodies unless stated otherwise.
- Protected requests use `Authorization: Bearer <JWT>`.
- New accounts default to `ATTENDEE`; never accept a privileged role directly from public registration.
- Use ISO 8601 timestamps, preferably UTC.
- The backend is the source of truth for capacity, registration state, and ticket validity.

## Standard error response

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "A short, user-safe explanation."
  }
}
```

Common statuses: `200` success, `201` created, `400` invalid input, `401` missing/invalid token, `403` insufficient role, `404` not found, `409` duplicate/conflict/full event, `500` unexpected server error.

## Authentication

### `POST /api/auth/register` — Public
Request: `{ "name": "Example User", "email": "user@example.com", "password": "Use-a-strong-password" }`

Creates an attendee account. Hash the password with bcrypt before storage. Do not accept `role` from the request body.

### `POST /api/auth/login` — Public
Request: `{ "email": "user@example.com", "password": "Use-a-strong-password" }`

Success: `{ "token": "<signed-jwt>", "user": { "userId": "user-id", "name": "Example User", "email": "user@example.com", "role": "ATTENDEE" } }`

## Events

- `GET /api/events` — Public. Optional query parameters: `q`, `category`, `from`, `to`, `limit`, `nextToken`. Return published upcoming events by default.
- `GET /api/events/{eventId}` — Public. Returns event details and capacity summary.
- `POST /api/events` — Organizer. Accepts `title`, `description`, `category`, `startAt`, `endAt`, `venue`, `capacity`, optional `bannerUrl`. Backend sets `confirmedCount` to `0`.
- `PATCH /api/events/{eventId}` — Organizer. Validates ownership and must not silently reduce capacity below confirmed RSVPs.

## RSVP and registrations

- `POST /api/events/{eventId}/rsvp` — Attendee. Creates a confirmed RSVP if capacity is available; otherwise creates a waitlist entry if registration is open. Confirmed example: `{ "status": "CONFIRMED", "rsvpId": "rsvp-id", "ticketId": "opaque-ticket-id" }`. Waitlisted example: `{ "status": "WAITLISTED", "rsvpId": "rsvp-id", "queuePosition": 2 }`.
- `DELETE /api/events/{eventId}/rsvp` — Attendee. Cancels the current user's RSVP, invalidates the old ticket, and processes promotion safely.
- `GET /api/me/rsvps` — Attendee. Returns the user's registrations, statuses, event summaries, and ticket IDs for confirmed registrations.
- `GET /api/tickets/{ticketId}` — Ticket owner/authorized staff. Returns only necessary ticket details.

## Attendees, check-in, statistics

- `GET /api/events/{eventId}/attendees?q={query}` — Organizer/Coordinator. Search by name, registered email, or ticket reference. Return minimum information needed for identification.
- `POST /api/events/{eventId}/check-in` — Organizer/Coordinator. Request: `{ "ticketId": "opaque-ticket-id" }`. Backend verifies ticket/event/status and performs a conditional single-use update.
- `GET /api/events/{eventId}/stats` — Organizer. Returns capacity, confirmed count, waitlist count, checked-in count, and attendance percentage.

## Optional S3 banner upload

- `POST /api/uploads/banner-url` — Organizer. Request: `{ "fileName": "event-banner.png", "contentType": "image/png" }`. Returns a short-lived presigned S3 upload URL and final banner URL. Validate allowed file types and size. If time is limited, upload banner assets manually and implement this endpoint later.

## Frontend expectations

- Handle loading, empty, success, and error states.
- Display the backend's actual RSVP status; never assume success before the API responds.
- Do not calculate or enforce capacity only in the frontend.
- QR scanning and manual lookup must use the same check-in endpoint.
