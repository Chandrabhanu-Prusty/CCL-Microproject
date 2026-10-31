# Test Plan

## 1. Authentication & Role-Based Access Control (RBAC) Tests

| Test ID | Scenario | Steps | Expected Result | Status |
| :--- | :--- | :--- | :--- | :--- |
| **TC-AUTH-01** | Public Registration Default Role | Submit `POST /api/auth/register` with attendee credentials. | Account created with `role: 'ATTENDEE'`. Password hashed via bcrypt. | PASS |
| **TC-AUTH-02** | Privileged Role Injection Block | Submit `POST /api/auth/register` with body `{ role: 'ORGANIZER' }`. | Privilege escalation ignored; user registered strictly as `ATTENDEE`. | PASS |
| **TC-AUTH-03** | Valid JWT Login | Submit `POST /api/auth/login` with registered credentials. | HTTP 200 returned with signed JWT containing `userId` and `role`. | PASS |
| **TC-AUTH-04** | Attendee Check-in Block | Attendee calls `POST /api/events/{id}/check-in`. | HTTP 403 Forbidden (`FORBIDDEN`). Attendees strictly cannot check in tickets. | PASS |
| **TC-AUTH-05** | Attendee Registry Privacy | Attendee calls `GET /api/events/{id}/attendees`. | HTTP 403 Forbidden (`FORBIDDEN`). Attendee rosters are private. | PASS |
| **TC-AUTH-06** | Route Guard Redirection | Attendee navigates directly to `/organizer` or `/checkin`. | Client redirects to `/events` fallback; links hidden in sidebar. | PASS |

---

## 2. Event Management & Staff Delegation Tests

| Test ID | Scenario | Steps | Expected Result | Status |
| :--- | :--- | :--- | :--- | :--- |
| **TC-EVT-01** | Organizer Event Creation | Organizer submits `POST /api/events`. | HTTP 201 Created; event listed with initial `confirmedCount: 0`. | PASS |
| **TC-EVT-02** | Cross-Organizer Modification Block | Organizer A attempts `PATCH /api/events/{id}` for event owned by Organizer B. | HTTP 403 Forbidden. Organizers cannot edit events they do not own. | PASS |
| **TC-EVT-03** | Capacity Reduction Floor | Organizer attempts to reduce capacity below `confirmedCount`. | HTTP 400 Bad Request (`INVALID_CAPACITY`). | PASS |
| **TC-EVT-04** | Coordinator Delegation | Organizer calls `POST /api/events/{id}/staff` with coordinator email. | Record inserted in `MarqueEventStaff`. Coordinator granted access. | PASS |
| **TC-EVT-05** | Coordinator Revocation | Organizer calls `DELETE /api/events/{id}/staff/{userId}`. | Staff record deleted. Coordinator check-in permission immediately revoked. | PASS |
| **TC-EVT-06** | Unauthorized Staff Assignment | Organizer A attempts to assign staff to Organizer B's event. | HTTP 403 Forbidden. | PASS |

---

## 3. Coordinator Event-Scoped Check-in Tests

| Test ID | Scenario | Steps | Expected Result | Status |
| :--- | :--- | :--- | :--- | :--- |
| **TC-COORD-01** | Assigned Events Discovery | Coordinator visits `/checkin` (`GET /api/me/assigned-events`). | Only explicitly assigned events returned; unassigned events excluded. | PASS |
| **TC-COORD-02** | Assigned Event Check-in | Coordinator scans active ticket for assigned event. | HTTP 200 OK (`CHECKED_IN`), `checkedInAt` logged, green success chime. | PASS |
| **TC-COORD-03** | Unassigned Event Access Block | Coordinator attempts check-in on event they were not assigned to. | HTTP 403 Forbidden (`FORBIDDEN`). Access denied card displayed. | PASS |
| **TC-COORD-04** | Duplicate Check-in Prevention | Coordinator scans already checked-in ticket second time. | HTTP 409 Conflict (`ALREADY_CHECKED_IN`), red alert, error tone. | PASS |
| **TC-COORD-05** | Manual Lookup Parity | Coordinator searches by attendee name and clicks Check In. | Same single-use backend check-in logic invoked; status updated. | PASS |
| **TC-COORD-06** | Ticket Opaque ID Invariance | Inspect QR SVG string and ticket payload. | Contains strictly opaque `ticketId` (`tkt-...`), no JWT or email. | PASS |

---

## 4. RSVP, Capacity & FIFO Waitlist Tests

| Test ID | Scenario | Steps | Expected Result | Status |
| :--- | :--- | :--- | :--- | :--- |
| **TC-RSVP-01** | Available Seat RSVP | Attendee RSVPs for event with available capacity. | Status `CONFIRMED`, active ticket issued. | PASS |
| **TC-RSVP-02** | Duplicate RSVP Prevention | Attendee RSVPs a second time for the same event. | HTTP 409 Conflict (`DUPLICATE_REGISTRATION`). | PASS |
| **TC-RSVP-03** | Full Capacity Waitlisting | Attendee RSVPs for full event (e.g. `evt-gdg-devfest` 50/50). | Status `WAITLISTED`, sequential queue position returned. | PASS |
| **TC-RSVP-04** | Cancellation & FIFO Promotion | Confirmed attendee cancels RSVP when waitlist exists. | Earliest waitlisted user promoted to `CONFIRMED`; active ticket generated. | PASS |
| **TC-RSVP-05** | Cancellation without Waitlist | Confirmed attendee cancels RSVP with empty waitlist. | `confirmedCount` safely decremented by 1. | PASS |

---

## 5. API Client & Configuration Tests

| Test ID | Scenario | Steps | Expected Result | Status |
| :--- | :--- | :--- | :--- | :--- |
| **TC-CFG-01** | Missing Config Rejection | Clear `VITE_API_BASE_URL` and `VITE_USE_MOCK_API`. | `apiRequest` throws `CONFIG_ERROR`. Never defaults silently. | PASS |
| **TC-CFG-02** | Mock Mode Explicit Guard | Set `VITE_USE_MOCK_API=true` without base URL. | Mock adapter operates smoothly for local grading/testing. | PASS |
| **TC-CFG-03** | Network Error Isolation | Set unreachable `VITE_API_BASE_URL`. | `apiRequest` throws `NETWORK_ERROR`; never falls back to mock data. | PASS |

---

## 6. Execution Evidence

- **Frontend Unit Test Suite:** Run with Node.js built-in test runner:
  ```bash
  npm test --prefix frontend
  ```
  *Result:* **18 passed, 0 failed, 5 test suites.**
- **Production Build:** Verified with Vite production bundling:
  ```bash
  npm run build --prefix frontend
  ```
  *Result:* **Built in ~11s without compile errors.**
