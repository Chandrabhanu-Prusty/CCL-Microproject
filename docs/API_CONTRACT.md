# API Contract — Final & Frozen Specification

Base URL: the deployed API Gateway HTTP API stage URL. Paths below are relative to that URL.

---

## 1. Global Conventions & Standards

- **Encoding & Data Format:** UTF-8 JSON request and response payloads.
- **Stateless Authentication:** Bearer JWT in `Authorization` header: `Authorization: Bearer <token>`.
- **Global Roles:** Strictly `ATTENDEE` and `ORGANIZER`. `COORDINATOR` is never a global role or JWT claim.
- **Event Check-in Authorization:** Validated on every staff request against `MarqueEventStaff` table. Organizers must explicitly assign themselves as staff if they wish to perform venue check-ins.
- **Timestamps:** ISO 8601 UTC formatted strings (e.g., `2026-11-15T09:00:00.000Z`).
- **Standard Success Format:** Standard envelope responses: `{ "events": [...] }`, `{ "event": {...} }`, `{ "ticket": {...} }`, `{ "rsvps": [...] }`.
- **Standard Error Format:**
  ```json
  {
    "error": {
      "code": "VALIDATION_ERROR",
      "message": "User-safe explanation of the error condition.",
      "details": {}
    }
  }
  ```

### HTTP Status Codes
- `200 OK`: Request succeeded.
- `201 Created`: Resource successfully created.
- `400 Bad Request`: Validation failure, missing required fields, or illegal capacity reduction.
- `401 Unauthorized`: Missing, expired, invalid, or forged Bearer JWT.
- `403 Forbidden`: Insufficient role or lack of explicit event assignment in `MarqueEventStaff`.
- `404 Not Found`: Target resource does not exist.
- `409 Conflict`: Duplicate registration, full capacity race condition, or ticket already checked in.
- `500 Internal Server Error`: Unhandled server exception.

---

## 2. Authentication Endpoints

### 2.1 Register User Account
- **HTTP Method:** `POST`
- **Path:** `/api/auth/register`
- **Auth Required:** No (Public)
- **Permissions:** None
- **Request Body:**
  ```json
  {
    "name": "Chandrabhanu Prusty",
    "email": "chandrabhanu@example.com",
    "password": "StrongPassword123!"
  }
  ```
- **Validation Rules:**
  - `name`: String, 2 to 100 characters.
  - `email`: Valid email format, max 254 chars. Normalized to lowercase.
  - `password`: String, minimum 8 characters, at least 1 number or special character.
  - `role`: Ignored if passed; backend **always** forces `role: "ATTENDEE"`.
- **Success Response (`201 Created`):**
  ```json
  {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "userId": "usr-8f3a9e1b2c4d",
      "name": "Chandrabhanu Prusty",
      "email": "chandrabhanu@example.com",
      "role": "ATTENDEE"
    }
  }
  ```
- **Errors:**
  - `400 VALIDATION_ERROR`: Invalid format or missing fields.
  - `409 EMAIL_ALREADY_EXISTS`: An account with this normalized email already exists.

### 2.2 Login User Account
- **HTTP Method:** `POST`
- **Path:** `/api/auth/login`
- **Auth Required:** No (Public)
- **Permissions:** None
- **Request Body:**
  ```json
  {
    "email": "chandrabhanu@example.com",
    "password": "StrongPassword123!"
  }
  ```
- **Validation Rules:** `email` and `password` required.
- **Success Response (`200 OK`):**
  ```json
  {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "userId": "usr-8f3a9e1b2c4d",
      "name": "Chandrabhanu Prusty",
      "email": "chandrabhanu@example.com",
      "role": "ATTENDEE"
    }
  }
  ```
- **Errors:**
  - `400 VALIDATION_ERROR`: Missing email or password.
  - `401 INVALID_CREDENTIALS`: Email not found or bcrypt verification failed.

---

## 3. Events Endpoints

### 3.1 List Published Events
- **HTTP Method:** `GET`
- **Path:** `/api/events`
- **Auth Required:** No (Public discovery; authenticated users may pass token)
- **Permissions:** Any
- **Query Parameters:**
  - `q` (optional): Case-insensitive text search filtering against event `title` or `venue`.
  - `category` (optional): Filter by category (`Technology`, `Workshop`, `Cultural`, `Academic`, `Sports`).
- **Success Response (`200 OK`):**
  ```json
  {
    "events": [
      {
        "eventId": "evt-ccl-hackathon-2026",
        "title": "Cloud Canvas 2026: Campus Hackathon",
        "description": "48-hour premier cloud computing hackathon.",
        "category": "Technology",
        "startAt": "2026-11-15T09:00:00.000Z",
        "endAt": "2026-11-17T17:00:00.000Z",
        "venue": "Auditorium & Lab 502, VESIT Campus",
        "capacity": 100,
        "confirmedCount": 88,
        "status": "PUBLISHED",
        "organizerId": "usr-organizer-01",
        "bannerUrl": "https://images.unsplash.com/..."
      }
    ]
  }
  ```

### 3.2 Get Event Details
- **HTTP Method:** `GET`
- **Path:** `/api/events/{eventId}`
- **Auth Required:** No (Public)
- **Path Parameters:** `eventId` (String, required)
- **Success Response (`200 OK`):**
  ```json
  {
    "event": {
      "eventId": "evt-ccl-hackathon-2026",
      "title": "Cloud Canvas 2026: Campus Hackathon",
      "description": "48-hour premier cloud computing hackathon.",
      "category": "Technology",
      "startAt": "2026-11-15T09:00:00.000Z",
      "endAt": "2026-11-17T17:00:00.000Z",
      "venue": "Auditorium & Lab 502, VESIT Campus",
      "capacity": 100,
      "confirmedCount": 88,
      "status": "PUBLISHED",
      "organizerId": "usr-organizer-01",
      "bannerUrl": "https://images.unsplash.com/...",
      "createdAt": "2026-10-01T10:00:00.000Z"
    }
  }
  ```
- **Errors:** `404 EVENT_NOT_FOUND`.

### 3.3 Create Campus Event
- **HTTP Method:** `POST`
- **Path:** `/api/events`
- **Auth Required:** Yes
- **Permissions:** Global role `ORGANIZER`
- **Request Body:**
  ```json
  {
    "title": "Zero-to-Production: Full-Stack React & AWS Workshop",
    "description": "Hands-on practical session building high-performance SPAs.",
    "category": "Workshop",
    "startAt": "2026-11-28T14:00:00.000Z",
    "endAt": "2026-11-28T17:00:00.000Z",
    "venue": "Seminar Hall B, IT Building",
    "capacity": 40,
    "bannerUrl": "https://images.unsplash.com/..."
  }
  ```
- **Validation Rules:**
  - `title`, `description`, `venue`, `startAt`: Required strings.
  - `category`: Must be one of `['Technology', 'Workshop', 'Cultural', 'Academic', 'Sports']`.
  - `capacity`: Integer $\ge 1$.
  - `startAt`: Valid future ISO 8601 string.
- **Success Response (`201 Created`):**
  ```json
  {
    "event": {
      "eventId": "evt-react-aws-2026",
      "title": "Zero-to-Production: Full-Stack React & AWS Workshop",
      "description": "Hands-on practical session building high-performance SPAs.",
      "category": "Workshop",
      "startAt": "2026-11-28T14:00:00.000Z",
      "endAt": "2026-11-28T17:00:00.000Z",
      "venue": "Seminar Hall B, IT Building",
      "capacity": 40,
      "confirmedCount": 0,
      "status": "PUBLISHED",
      "organizerId": "usr-organizer-01",
      "bannerUrl": "https://images.unsplash.com/...",
      "createdAt": "2026-10-31T12:00:00.000Z"
    }
  }
  ```
- **Errors:**
  - `401 UNAUTHORIZED`: Missing/invalid token.
  - `403 FORBIDDEN`: Caller's global role is not `ORGANIZER`.
  - `400 VALIDATION_ERROR`: Field validation failed.

### 3.4 Update Event
- **HTTP Method:** `PATCH`
- **Path:** `/api/events/{eventId}`
- **Auth Required:** Yes
- **Permissions:** Global role `ORGANIZER` AND caller must be the event owner (`event.organizerId === user.userId`)
- **Request Body:** Partial update fields (`title`, `description`, `category`, `startAt`, `endAt`, `venue`, `capacity`, `bannerUrl`).
- **Validation Rules:**
  - If `capacity` is provided, it cannot be less than the current `confirmedCount`.
- **Success Response (`200 OK`):**
  ```json
  {
    "event": {
      "eventId": "evt-ccl-hackathon-2026",
      "title": "Cloud Canvas 2026: Campus Hackathon (Updated)",
      "description": "48-hour premier cloud computing hackathon.",
      "category": "Technology",
      "startAt": "2026-11-15T09:00:00.000Z",
      "endAt": "2026-11-17T17:00:00.000Z",
      "venue": "Auditorium & Lab 502, VESIT Campus",
      "capacity": 120,
      "confirmedCount": 88,
      "status": "PUBLISHED",
      "organizerId": "usr-organizer-01",
      "bannerUrl": "https://images.unsplash.com/...",
      "updatedAt": "2026-10-31T12:00:00.000Z"
    }
  }
  ```
- **Errors:**
  - `401 UNAUTHORIZED`: Missing/invalid token.
  - `403 FORBIDDEN`: Caller is not `ORGANIZER` or does not own this event.
  - `400 INVALID_CAPACITY`: Requested capacity is less than existing confirmed attendees.
  - `404 EVENT_NOT_FOUND`: Event does not exist.

---

## 4. Event Staff & Coordinator Delegation Endpoints

### 4.1 List Assigned Coordinators for Event
- **HTTP Method:** `GET`
- **Path:** `/api/events/{eventId}/staff`
- **Auth Required:** Yes
- **Permissions:** Global role `ORGANIZER` AND owner of `eventId`
- **Success Response (`200 OK`):**
  ```json
  {
    "staff": [
      {
        "eventId": "evt-ccl-hackathon-2026",
        "userId": "usr-coord-01",
        "email": "preeti.coord@example.com",
        "name": "Preeti Coordinator",
        "permission": "CHECK_IN",
        "assignedAt": "2026-10-12T10:00:00.000Z",
        "assignedBy": "usr-organizer-01"
      }
    ]
  }
  ```
- **Errors:** `401 UNAUTHORIZED`, `403 FORBIDDEN` (not event owner), `404 EVENT_NOT_FOUND`.

### 4.2 Assign Coordinator to Event
- **HTTP Method:** `POST`
- **Path:** `/api/events/{eventId}/staff`
- **Auth Required:** Yes
- **Permissions:** Global role `ORGANIZER` AND owner of `eventId`
- **Request Body:**
  ```json
  {
    "email": "preeti.coord@example.com"
  }
  ```
- **Validation Rules:**
  - `email`: Required valid email address.
  - Look up target user in `MarqueUsers` using strongly consistent base table email lock query. Target account must already exist.
  - Does NOT alter the user's global role in `MarqueUsers` (stays `ATTENDEE` or `ORGANIZER`).
  - Inserts staff record into `MarqueEventStaff` with `permission: "CHECK_IN"`.
- **Success Response (`201 Created`):**
  ```json
  {
    "assignment": {
      "eventId": "evt-ccl-hackathon-2026",
      "userId": "usr-coord-01",
      "email": "preeti.coord@example.com",
      "name": "Preeti Coordinator",
      "permission": "CHECK_IN",
      "assignedAt": "2026-10-12T10:00:00.000Z",
      "assignedBy": "usr-organizer-01"
    }
  }
  ```
- **Errors:**
  - `400 USER_NOT_FOUND`: No registered account exists with this email address. Pre-registration is required.
  - `403 FORBIDDEN`: Caller does not own this event.
  - `409 ALREADY_ASSIGNED`: User is already an active coordinator for this event.

### 4.3 Revoke Coordinator Assignment
- **HTTP Method:** `DELETE`
- **Path:** `/api/events/{eventId}/staff/{userId}`
- **Auth Required:** Yes
- **Permissions:** Global role `ORGANIZER` AND owner of `eventId`
- **Success Response (`200 OK`):**
  ```json
  {
    "message": "Coordinator assignment successfully revoked."
  }
  ```
- **Errors:** `401 UNAUTHORIZED`, `403 FORBIDDEN` (not event owner), `404 STAFF_NOT_FOUND`.

### 4.4 List Assigned Events for Current User
- **HTTP Method:** `GET`
- **Path:** `/api/me/assigned-events`
- **Auth Required:** Yes
- **Permissions:** Any authenticated user (`ATTENDEE` or `ORGANIZER`)
- **Behavior:**
  - Queries `MarqueEventStaff` GSI `user-assigned-events-index` for `userId = caller.userId`.
  - Returns strictly the events where the caller has been explicitly assigned as check-in staff (does not automatically return unassigned events owned by an organizer).
- **Success Response (`200 OK`):**
  ```json
  {
    "events": [
      {
        "eventId": "evt-ccl-hackathon-2026",
        "title": "Cloud Canvas 2026: Campus Hackathon",
        "venue": "Auditorium & Lab 502, VESIT Campus",
        "startAt": "2026-11-15T09:00:00.000Z",
        "confirmedCount": 88
      }
    ]
  }
  ```

---

## 5. RSVP & Waitlist Endpoints

### 5.1 Register RSVP / Join Waitlist
- **HTTP Method:** `POST`
- **Path:** `/api/events/{eventId}/rsvp`
- **Auth Required:** Yes
- **Permissions:** Any authenticated user
- **Request Body:** Empty `{}`
- **Behavior & Atomic Outcomes:**
  - If user already holds an active `CONFIRMED` or `WAITLISTED` registration, reject with `409 DUPLICATE_REGISTRATION`.
  - **Seat Available (`confirmedCount < capacity`):**
    - Atomically increments `confirmedCount` by 1.
    - Creates `MarqueRSVPs` record with `status: "CONFIRMED"` and generated opaque `ticketId`.
    - Creates `MarqueTickets` record with `status: "ACTIVE"`.
    - Returns `201 Created`:
      ```json
      {
        "status": "CONFIRMED",
        "rsvpId": "rsvp-9a8b7c6d",
        "ticketId": "tkt-8f3a9e1b2c4d",
        "message": "Registration confirmed. Your digital pass is available."
      }
      ```
  - **Seat Full (`confirmedCount >= capacity`):**
    - Inserts user into `MarqueWaitlist` with queue key `<ISO8601_NOW>#<userId>`.
    - Creates `MarqueRSVPs` record with `status: "WAITLISTED"` and `queueKey: "<ISO8601_NOW>#<userId>"`.
    - Determines `queuePosition` via strongly consistent base table count.
    - Returns `200 OK` (Note: waitlisting is an authorized, expected flow, not an error):
      ```json
      {
        "status": "WAITLISTED",
        "rsvpId": "rsvp-9a8b7c6d",
        "queuePosition": 3,
        "queueKey": "2026-10-31T12:01:00.000Z#usr-waitlist-01",
        "message": "Event is currently full. You have been placed in the FIFO waitlist."
      }
      ```
- **Errors:**
  - `401 UNAUTHORIZED`: Missing token.
  - `404 EVENT_NOT_FOUND`: Invalid eventId.
  - `409 DUPLICATE_REGISTRATION`: Caller is already registered or waitlisted.

### 5.2 Cancel RSVP Registration
- **HTTP Method:** `DELETE`
- **Path:** `/api/events/{eventId}/rsvp`
- **Auth Required:** Yes
- **Permissions:** Any authenticated attendee (cancels own registration)
- **Behavior & Atomic Outcomes:**
  - If caller holds a `CONFIRMED` RSVP:
    - Atomically cancels the current RSVP and associated `MarqueTickets` entry.
    - Queries `MarqueWaitlist` for oldest entry (`ScanIndexForward = true`, `Limit = 1`).
    - **If waitlist candidate exists:** Promotes candidate to `CONFIRMED`, generates new active ticket, transactionally deletes queue entry from `MarqueWaitlist`. Capacity count remains steady.
    - **If waitlist is empty:** Atomically decrements `confirmedCount` by 1.
  - If caller holds a `WAITLISTED` RSVP:
    - Transactionally deletes entry directly from `MarqueWaitlist` using the `queueKey` recorded on `MarqueRSVPs` and sets RSVP status to `CANCELLED`.
- **Success Response (`200 OK`):**
  ```json
  {
    "message": "Registration successfully cancelled.",
    "promotedAttendee": "Aarav Sharma"
  }
  ```
- **Errors:** `401 UNAUTHORIZED`, `404 RSVP_NOT_FOUND`.

### 5.3 Get Current User Registrations
- **HTTP Method:** `GET`
- **Path:** `/api/me/rsvps`
- **Auth Required:** Yes
- **Permissions:** Any authenticated user
- **Success Response (`200 OK`):**
  ```json
  {
    "rsvps": [
      {
        "rsvpId": "rsvp-9a8b7c6d",
        "eventId": "evt-ccl-hackathon-2026",
        "status": "CONFIRMED",
        "ticketId": "tkt-8f3a9e1b2c4d",
        "queueKey": null,
        "createdAt": "2026-10-18T10:00:00.000Z",
        "event": {
          "title": "Cloud Canvas 2026: Campus Hackathon",
          "venue": "Auditorium & Lab 502, VESIT Campus",
          "startAt": "2026-11-15T09:00:00.000Z"
        }
      }
    ]
  }
  ```

---

## 6. Tickets & Digital Pass Endpoints

### 6.1 Get Ticket Details
- **HTTP Method:** `GET`
- **Path:** `/api/tickets/{ticketId}`
- **Auth Required:** Yes
- **Permissions:** Ticket owner only (`ticket.attendeeId === user.userId`)
- **Security Rule:** Event check-in staff do NOT use this endpoint; staff must use the attendee search or check-in verification endpoints.
- **Success Response (`200 OK`):**
  ```json
  {
    "ticket": {
      "ticketId": "tkt-8f3a9e1b2c4d",
      "eventId": "evt-ccl-hackathon-2026",
      "attendeeId": "usr-attendee-demo",
      "attendeeName": "Chandrabhanu Prusty",
      "attendeeEmail": "chandrabhanu@example.com",
      "eventTitle": "Cloud Canvas 2026: Campus Hackathon",
      "eventVenue": "Auditorium & Lab 502, VESIT Campus",
      "eventStartAt": "2026-11-15T09:00:00.000Z",
      "status": "ACTIVE",
      "issuedAt": "2026-10-18T10:00:00.000Z",
      "checkedInAt": null
    }
  }
  ```
- **Errors:**
  - `401 UNAUTHORIZED`: Missing token.
  - `403 FORBIDDEN`: Caller is not the ticket owner.
  - `404 TICKET_NOT_FOUND`: Invalid ticket reference.

---

## 7. Venue Check-in & Attendee Search Endpoints

### 7.1 Search Event Attendees for Check-in
- **HTTP Method:** `GET`
- **Path:** `/api/events/{eventId}/attendees`
- **Auth Required:** Yes
- **Permissions:** Event owner (`ORGANIZER`) OR explicit check-in staff in `MarqueEventStaff`
- **Query Parameters:**
  - `q` (required for coordinators, min 2 chars): Search term matching name, email, or ticket ID.
  - For event owners (organizers), `q` is optional (allows full roster inspection).
- **Behavior & Data Privacy:**
  - Organizers viewing their owned event receive full attendee records including complete emails.
  - Assigned check-in staff (coordinators) receive minimal verification fields (`ticketId`, `attendeeName`, masked email like `ch***@example.com`, `status`, `checkedInAt`).
- **Success Response (`200 OK`):**
  ```json
  {
    "attendees": [
      {
        "ticketId": "tkt-8f3a9e1b2c4d",
        "attendeeName": "Chandrabhanu Prusty",
        "attendeeEmail": "ch***@example.com",
        "status": "ACTIVE",
        "checkedInAt": null
      }
    ]
  }
  ```
- **Errors:**
  - `400 QUERY_REQUIRED`: Check-in staff must supply `q` parameter of at least 2 characters.
  - `401 UNAUTHORIZED`: Missing token.
  - `403 FORBIDDEN`: Caller is not assigned staff or event owner.

### 7.2 Execute Single-Use Ticket Check-in
- **HTTP Method:** `POST`
- **Path:** `/api/events/{eventId}/check-in`
- **Auth Required:** Yes
- **Permissions:** **Explicit staff assignment in `MarqueEventStaff` required for all callers**. Organizers who wish to check in attendees must explicitly assign themselves to the event's staff roster.
- **Request Body:**
  ```json
  {
    "ticketId": "tkt-8f3a9e1b2c4d"
  }
  ```
- **Atomic Validation & Idempotency Rules:**
  1. Caller must have an explicit assignment in `MarqueEventStaff` with `eventId = :eventId AND userId = :callerId`. Unassigned users (including unassigned organizers) are rejected with `403 FORBIDDEN`.
  2. Ticket exists and matches `ticket.eventId === eventId`.
  3. Ticket status must be strictly `ACTIVE`.
  4. Conditional update transitions ticket to `CHECKED_IN`, recording `checkedInAt` and `checkedInBy`.
- **Success Response (`200 OK`):**
  ```json
  {
    "status": "CHECKED_IN",
    "ticketId": "tkt-8f3a9e1b2c4d",
    "attendeeName": "Chandrabhanu Prusty",
    "attendeeEmail": "chandrabhanu@example.com",
    "checkedInAt": "2026-11-15T09:15:00.000Z",
    "checkedInBy": "Preeti Coordinator"
  }
  ```
- **Errors:**
  - `400 INVALID_EVENT`: Ticket belongs to a different event.
  - `400 TICKET_INACTIVE`: Ticket is cancelled or expired.
  - `403 FORBIDDEN`: Caller is not explicitly assigned in `MarqueEventStaff` for this event.
  - `404 TICKET_NOT_FOUND`: Ticket reference does not exist.
  - `409 ALREADY_CHECKED_IN`:
    ```json
    {
      "error": {
        "code": "ALREADY_CHECKED_IN",
        "message": "Ticket already checked in at 9:15 AM by Preeti Coordinator."
      }
    }
    ```

---

## 8. Statistics Endpoints

### 8.1 Full Organizer Event Analytics
- **HTTP Method:** `GET`
- **Path:** `/api/events/{eventId}/stats`
- **Auth Required:** Yes
- **Permissions:** Event owner (`ORGANIZER`) only
- **Success Response (`200 OK`):**
  ```json
  {
    "capacity": 100,
    "confirmedCount": 88,
    "waitlistCount": 12,
    "checkedInCount": 65,
    "attendancePercentage": 74
  }
  ```
- **Errors:** `401 UNAUTHORIZED`, `403 FORBIDDEN` (coordinators and attendees blocked).

### 8.2 Coordinator Check-in Summary
- **HTTP Method:** `GET`
- **Path:** `/api/events/{eventId}/checkin-summary`
- **Auth Required:** Yes
- **Permissions:** **Explicit staff assignment in `MarqueEventStaff` required**.
- **Success Response (`200 OK`):**
  ```json
  {
    "confirmedCount": 88,
    "checkedInCount": 65
  }
  ```
- **Errors:** `401 UNAUTHORIZED`, `403 FORBIDDEN` (caller is not in `MarqueEventStaff`).

---

## 9. S3 Banner Uploads Endpoint

### 9.1 Presigned Banner Upload URL
- **HTTP Method:** `POST`
- **Path:** `/api/uploads/banner-url`
- **Auth Required:** Yes
- **Permissions:** Global role `ORGANIZER`
- **Request Body:**
  ```json
  {
    "fileName": "hackathon-banner.png",
    "contentType": "image/png"
  }
  ```
- **Validation Rules:**
  - `contentType` must be one of `image/jpeg`, `image/png`, `image/webp`.
  - Enforce max file size 5MB in policy.
- **Success Response (`200 OK`):**
  ```json
  {
    "uploadUrl": "https://marque-banners-xxx.s3.amazonaws.com/raw/...?AWSAccessKeyId=...",
    "bannerUrl": "https://marque-banners-xxx.s3.amazonaws.com/banners/hackathon-banner.png"
  }
  ```
- **Errors:** `400 INVALID_CONTENT_TYPE`, `401 UNAUTHORIZED`, `403 FORBIDDEN`.
