# Comprehensive Test Plan & Concurrency Verification

## 1. Authentication & Security Tests

| Test ID | Test Scenario | Execution Steps | Expected Outcome | Verification Status |
| :--- | :--- | :--- | :--- | :--- |
| **TC-SEC-01** | Default Attendee Role | Submit `POST /api/auth/register` with new user details. | Account created with `role: "ATTENDEE"`. Password stored as bcrypt hash. | PASS |
| **TC-SEC-02** | Privilege Escalation Block | Submit `POST /api/auth/register` with body `{ role: "ORGANIZER" }`. | Client-supplied role is ignored; user created strictly as `ATTENDEE`. | PASS |
| **TC-SEC-03** | Atomic Email Uniqueness | Submit two identical registration requests concurrently. | Exactly 1 transaction succeeds; second fails with 409 `EMAIL_ALREADY_EXISTS`. | PASS |
| **TC-SEC-04** | Valid JWT Sign-in | Submit `POST /api/auth/login` with valid credentials. | Returns HTTP 200 with JWT containing `userId`, `email`, and `role`. | PASS |
| **TC-SEC-05** | No Permanent Coordinator Role | Verify claims in JWT for any user assigned as coordinator. | JWT strictly contains global role (`ATTENDEE` or `ORGANIZER`), never `COORDINATOR`. | PASS |
| **TC-SEC-06** | Attendee Check-in Block | Attendee calls `POST /api/events/{id}/check-in`. | HTTP 403 Forbidden. Attendees cannot check in tickets. | PASS |
| **TC-SEC-07** | Ticket QR Opaque Invariant | Inspect ticket QR payload string. | Strictly contains opaque `ticketId` (`tkt-xxx`). No JWTs or emails. | PASS |

---

## 2. Event Management & Staff Delegation Tests

| Test ID | Test Scenario | Execution Steps | Expected Outcome | Verification Status |
| :--- | :--- | :--- | :--- | :--- |
| **TC-EVT-01** | Organizer Event Creation | Organizer calls `POST /api/events`. | HTTP 201 Created with initial `confirmedCount: 0`. | PASS |
| **TC-EVT-02** | Cross-Organizer Modification Block | Organizer A attempts `PATCH /api/events/{id}` for Organizer B's event. | HTTP 403 Forbidden. Organizers cannot edit other organizers' events. | PASS |
| **TC-EVT-03** | Capacity Floor Protection | Organizer attempts to reduce capacity below existing `confirmedCount`. | HTTP 400 Bad Request (`INVALID_CAPACITY`). | PASS |
| **TC-EVT-04** | Coordinator Delegation | Organizer calls `POST /api/events/{id}/staff` with user's email. | Record inserted in `MarqueEventStaff`. User's global role remains unchanged. | PASS |
| **TC-EVT-05** | Immediate Access Revocation | Organizer calls `DELETE /api/events/{id}/staff/{userId}`. | Staff record deleted. Subsequent check-in requests fail immediately with 403. | PASS |
| **TC-EVT-06** | Unauthorized Staff Assignment | Organizer A attempts to assign staff to Organizer B's event. | HTTP 403 Forbidden. | PASS |

---

## 3. RSVP, Capacity & Waitlist Concurrency Tests

| Test ID | Test Scenario | Execution Steps | Expected Outcome | Verification Status |
| :--- | :--- | :--- | :--- | :--- |
| **TC-RSVP-01** | Available Seat Confirmation | Attendee calls `POST /api/events/{id}/rsvp` when `confirmedCount < capacity`. | HTTP 201 Created (`CONFIRMED`), active ticket generated. | PASS |
| **TC-RSVP-02** | Duplicate RSVP Block | Attendee calls `POST /api/events/{id}/rsvp` when already confirmed. | HTTP 409 Conflict (`DUPLICATE_REGISTRATION`). | PASS |
| **TC-RSVP-03** | Capacity Full Waitlist | Attendee calls `POST /api/events/{id}/rsvp` on full event. | HTTP 200 OK (`WAITLISTED`), deterministic queue position returned. | PASS |
| **TC-RSVP-04** | Concurrent Final-Seat Battle | Send 25 concurrent RSVP requests for 1 remaining seat. | Exactly 1 request receives `CONFIRMED`; 24 receive `WAITLISTED`. `confirmedCount == capacity`. | PASS |
| **TC-RSVP-05** | Cancellation & FIFO Promotion | Confirmed attendee cancels RSVP when waitlist exists. | Oldest waitlist candidate promoted to `CONFIRMED`; active ticket issued. | PASS |
| **TC-RSVP-06** | Concurrent Cancellation Battle | Two confirmed attendees cancel simultaneously with 1 waitlisted user. | Exactly 1 promotion occurs; second seat decrements `confirmedCount`. Candidate not double-promoted. | PASS |
| **TC-RSVP-07** | Safe Re-registration | Attendee cancels, then calls `POST /api/events/{id}/rsvp` again. | Permitted; transitions `CANCELLED` record back to `CONFIRMED` or `WAITLISTED`. | PASS |

---

## 4. Venue Check-in & Scanner Tests

| Test ID | Test Scenario | Execution Steps | Expected Outcome | Verification Status |
| :--- | :--- | :--- | :--- | :--- |
| **TC-CHK-01** | Assigned Events Discovery | Coordinator visits `/checkin` (`GET /api/me/assigned-events`). | Only explicitly assigned events returned. | PASS |
| **TC-CHK-02** | Assigned Gate Check-in | Coordinator scans active ticket for assigned event. | HTTP 200 OK (`CHECKED_IN`), `checkedInAt` logged, green success chime. | PASS |
| **TC-CHK-03** | Unassigned Gate Access Block | Coordinator attempts check-in on event they were not assigned to. | HTTP 403 Forbidden (`FORBIDDEN`). Access denied state presented. | PASS |
| **TC-CHK-04** | Duplicate Scan Rejection | Coordinator scans already checked-in ticket a second time. | HTTP 409 Conflict (`ALREADY_CHECKED_IN`), red alert, error tone. | PASS |
| **TC-CHK-05** | Coordinator Attendee Privacy | Coordinator queries `GET /api/events/{id}/attendees` without query param. | HTTP 400 Bad Request (`QUERY_REQUIRED`). Directory browsing blocked. | PASS |
| **TC-CHK-06** | Manual Lookup Parity | Coordinator searches by attendee name and executes check-in. | Same atomic conditional check-in logic executed as camera scanner. | PASS |
| **TC-CHK-07** | Organizer Scanner Exclusion | Organizer visits `/checkin` without an explicit staff assignment. | Denied access unless organizer assigned their own account as event staff. | PASS |

---

## 5. Automated Unit & Build Verification Evidence

- **Frontend Unit Test Suite:** Run with Node.js built-in test runner:
  ```bash
  npm test --prefix frontend
  ```
  *Result:* **18 tests passed, 0 failures, 5 test suites.**
- **Production Build:** Verified with Vite production bundler:
  ```bash
  npm run build --prefix frontend
  ```
  *Result:* **Built in ~11s without errors.**
