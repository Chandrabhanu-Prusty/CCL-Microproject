# Team Responsibilities & Ownership Boundaries

## Shared Rules & Code Quality Standards

- **Shared Repository:** https://github.com/Chandrabhanu-Prusty/CCL-Microproject
- **Frozen Specifications:** All implementation must strictly conform to `docs/API_CONTRACT.md` and `docs/DATABASE_DESIGN.md`. Backend developers must not invent endpoint paths, DynamoDB keys, or authorization mechanisms.
- **Security Boundaries:** Strictly enforce `docs/SECURITY.md`. Never trust client-supplied roles, ownership IDs, or check-in counters.
- **Git Protocol:** Feature branch isolation (`feature/aws-auth-events`, `feature/rsvp-waitlist-checkin`). Open PRs with test evidence before merging to `main`.
- **Zero Secrets in Code:** Never commit `.env` files, API keys, or AWS access tokens.

---

## 1. Chandrabhanu — Frontend Engineering & System Integration

**Branch:** `feature/frontend`

**Core Scope:**
- Production React + Vite Single Page Application conforming to the GDG-inspired graphite design system (`DESIGN.md`).
- Strict client-side route guards and navigation reflecting the pure two-tier role model:
  - Global `ATTENDEE` and `ORGANIZER` views.
  - Coordinator navigation driven strictly by live event assignments (`GET /api/me/assigned-events`).
  - Read-only digital pass (`/tickets/{ticketId}`) rendering opaque ticket QR codes.
- Camera-based WebRTC scanner with fallbacks to manual query-based attendee search.
- Mock data adapter (`mockData.js`) strictly isolated behind `VITE_USE_MOCK_API=true`.
- Zero mock fallbacks when `VITE_API_BASE_URL` is set.
- Deploy frontend to Vercel over HTTPS and verify mobile camera permissions.

---

## 2. Neilsen — Authentication, Event Studio & Staff Delegation Handlers

**Branch:** `feature/aws-auth-events`

**Core Scope:**
- Lambda entry point routing and shared error serialization matching the standard format:
  ```json
  { "error": { "code": "...", "message": "...", "details": {} } }
  ```
- **Authentication Handlers:**
  - `POST /api/auth/register`: Implement transactional email lock in `MarqueUsers` and bcrypt hashing. Always assign `role: "ATTENDEE"`.
  - `POST /api/auth/login`: Validate credentials against bcrypt hash and issue stateless Bearer JWT containing `{ userId, email, role }`.
- **Event Studio Handlers:**
  - `GET /api/events` & `GET /api/events/{eventId}`: Public event listing with category/text filters.
  - `POST /api/events`: Event creation restricted to global role `ORGANIZER`.
  - `PATCH /api/events/{eventId}`: Validate event ownership (`event.organizerId === user.userId`) and reject capacity reduction below `confirmedCount`.
- **Staff Delegation Handlers:**
  - `GET /api/events/{eventId}/staff`: Owner-only coordinator roster query.
  - `POST /api/events/{eventId}/staff`: Assign coordinator by email; write to `MarqueEventStaff` without altering the user's global role.
  - `DELETE /api/events/{eventId}/staff/{userId}`: Revoke coordinator check-in authorization.
  - `GET /api/me/assigned-events`: Query `user-assigned-events-index` for caller's assigned events.
- **S3 Presigned URL Handler:**
  - `POST /api/uploads/banner-url`: Validate organizer ownership and generate short-lived presigned upload URL.

---

## 3. Preeti — Transactional RSVP, Waitlist, Single-Use Check-in & Analytics

**Branch:** `feature/rsvp-waitlist-checkin`

**Core Scope:**
- Provision DynamoDB tables: `MarqueUsers`, `MarqueEvents`, `MarqueEventStaff`, `MarqueRSVPs`, `MarqueWaitlist`, `MarqueTickets`.
- **Capacity-Safe RSVP Engine:**
  - `POST /api/events/{eventId}/rsvp`: Implement `TransactWriteItems` updating `confirmedCount` with condition `confirmedCount < capacity`.
  - Fallback to `MarqueWaitlist` on capacity full returning `200 OK` (`WAITLISTED`).
- **Deterministic FIFO Promotion Engine:**
  - `DELETE /api/events/{eventId}/rsvp`: Self-cancellation handler.
  - Query oldest waiting entry on `MarqueWaitlist` base table using **Strongly Consistent Reads**.
  - Atomically promote waitlist candidate, activate ticket, and preserve capacity tally.
- **Digital Passes & Single-Use Check-in Handlers:**
  - `GET /api/tickets/{ticketId}`: Owner-only ticket view.
  - `GET /api/events/{eventId}/attendees`: Enforce search query parameter for coordinators; return masked PII.
  - `POST /api/events/{eventId}/check-in`:
    - Verify caller in `MarqueEventStaff` for `eventId`.
    - Execute atomic conditional update `#status = :checkedIn` WHERE `#status = :active`.
    - Return 409 `ALREADY_CHECKED_IN` on duplicate scan.
- **Analytics Handlers:**
  - `GET /api/events/{eventId}/stats`: Full registration and waitlist statistics for event owner.
  - `GET /api/events/{eventId}/checkin-summary`: Minimal check-in counter for assigned coordinators.
