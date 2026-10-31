# Team Responsibilities

## Shared Rules

- **Shared repository:** https://github.com/Chandrabhanu-Prusty/CCL-Microproject
- Agree on `API_CONTRACT.md` and `DATABASE_DESIGN.md` before merging backend changes.
- Work on separate feature branches; commit small, testable, verifiable changes.
- Never commit secrets, AWS Access Keys, or `.env` files.
- Open pull requests with test evidence and request review before merging to `main`.
- Each member owns implementation/testing of their assigned scope; all members participate in end-to-end integration.

---

## 1. Chandrabhanu — Frontend Engineering, UI/UX & Integration

**Branch:** `feature/frontend`

**Core Ownership:**
- Redesign and implement the complete React + Vite application shell matching the dark graphite GDG-inspired design system (`#0D0E12`, `#14151B`, `#1B1D24`, `#F04F8B`, `#FF984F`).
- Implement strict client-side Role-Based Access Control (RBAC):
  - **Attendee Experience:** Event discovery, search/filter, event details, RSVP/waitlist, My RSVPs (`/my-registrations`), and digital QR ticket display (`/tickets/{ticketId}`). Strictly eliminate scanners, check-in links, and organizer dashboards from attendee views.
  - **Organizer Experience:** Manage Events dashboard (`/organizer`), event creation/editing modal, attendee roster modal, live attendance analytics modal, and coordinator delegation modal (`eventStaffService`).
  - **Coordinator Experience:** Dedicated venue check-in workspace (`/checkin`, `/checkin/{eventId}`), assigned events discovery (`GET /api/me/assigned-events`), WebRTC camera scanner, manual lookup fallback, and sound feedback chimes.
- Implement isolated mock adapter (`mockData.js`) with 3 distinct test personas (`usr-attendee-demo`, `usr-organizer-01`, `usr-coordinator-01`).
- Ensure robust HTTP API client (`apiClient.js`) adhering to `API_CONTRACT.md`, strictly disabling mock fallback when `VITE_API_BASE_URL` is set.
- Maintain comprehensive unit tests (`npm test --prefix frontend`) and production builds (`npm run build --prefix frontend`).
- Deploy frontend to Vercel over HTTPS and verify mobile camera permissions.

**Deliverables:** Production frontend SPA, UI design system (`DESIGN.md`), role-separated client navigation, test suite passing 18/18 checks, and Vercel deployment.

---

## 2. Neilsen — JWT Authentication, API Gateway & Event Management Handlers

**Branch:** `feature/aws-auth-events`

**Core Ownership:**
- Implement Lambda entry point (`backend/src/handlers/auth/`, `backend/src/handlers/events/`).
- Build user registration and authentication handlers with bcrypt password hashing (10 rounds).
- Enforce default `ATTENDEE` role on public signup; reject client-supplied elevated privileges.
- Implement stateless HMAC SHA-256 JWT generation and verification middleware (`authMiddleware.js`).
- Implement event CRUD handlers (`POST /api/events`, `PATCH /api/events/{eventId}`, `GET /api/events`).
- Validate organizer event ownership (`event.organizerId === user.userId`) on all edit operations.
- Implement coordinator assignment endpoints (`POST /api/events/{eventId}/staff`, `DELETE /api/events/{eventId}/staff/{userId}`, `GET /api/events/{eventId}/staff`).
- Configure Amazon API Gateway HTTP API routes, stage variables, and CORS policies for the Vercel frontend.
- Document environment variables: `JWT_SECRET`, `USERS_TABLE_NAME`, `EVENTS_TABLE_NAME`, `EVENT_STAFF_TABLE_NAME`.

**Deliverables:** Authentication service, event management handlers, staff delegation APIs, API Gateway route mappings, and Postman authentication tests.

---

## 3. Preeti — DynamoDB Schema, Capacity Safe RSVP, Waitlist & Check-in

**Branch:** `feature/rsvp-waitlist-checkin`

**Core Ownership:**
- Provision and manage DynamoDB tables: `MarqueUsers`, `MarqueEvents`, `MarqueEventStaff`, `MarqueRSVPs`, `MarqueWaitlist`, `MarqueTickets`.
- Implement `eventStaffRepository.js` and `GET /api/me/assigned-events` handler.
- Build capacity-safe RSVP handler (`POST /api/events/{eventId}/rsvp`) utilizing `TransactWriteItems` with condition `confirmedCount < capacity`.
- Build FIFO waitlist queue mechanism sorting by `ISO_TIMESTAMP#userId`.
- Implement cancellation and atomic promotion flow (`DELETE /api/events/{eventId}/rsvp`):
  - Query earliest waiting user via GSI `event-queue-index`.
  - Atomically promote waitlisted user, activate ticket, and preserve capacity tally.
- Implement event-scoped check-in handler (`POST /api/events/{eventId}/check-in`):
  - Verify caller is event owner OR listed in `MarqueEventStaff`. Reject attendees with HTTP 403.
  - Verify ticket is `ACTIVE` and belongs to `eventId`.
  - Execute conditional update to `CHECKED_IN` preventing race conditions or duplicate check-in.
- Implement attendee lookup (`GET /api/events/{eventId}/attendees`) and live analytics (`GET /api/events/{eventId}/stats`).

**Deliverables:** DynamoDB table definitions, transactional RSVP/waitlist service, single-use check-in handler, and concurrency test reports.

---

## Handover & Integration Checklist

1. **API Alignment:** All endpoints match the specifications in `docs/API_CONTRACT.md`.
2. **Database Alignment:** Table names, primary keys, and GSIs match `docs/DATABASE_DESIGN.md`.
3. **Security Boundaries:** Strict enforcement of `docs/SECURITY.md` across both frontend guards and Lambda middleware.
4. **Local Verification:**
   - Frontend tests pass: `npm test --prefix frontend`
   - Frontend builds cleanly: `npm run build --prefix frontend`
5. **Configuration:** All environment variables documented without values (`.env.example`).
