# Project Overview — Final & Frozen Architectural Foundations

## 1. Purpose & Vision

Marque is a responsive campus event management, free RSVP, and single-use digital ticketing web application inspired by premier community platforms (such as Bevy and the GDG event platform). It provides strict separation of responsibilities across campus participants, event owners, and gate admission staff.

---

## 2. Frozen Stakeholder Model

```
+-----------------------------------+------------------------------------+------------------------------------+
| Stakeholder                       | Scope & Definition                 | Key Privileges & Boundaries        |
+-----------------------------------+------------------------------------+------------------------------------+
| ATTENDEE                          | Global Account Role                | Discover events, free RSVP, join   |
| (Campus Participant)              | (Default on self-registration)     | waitlist, cancel, show QR pass.    |
|                                   |                                    | NO scanner, NO attendee lookup.    |
+-----------------------------------+------------------------------------+------------------------------------+
| ORGANIZER                         | Global Account Role                | Create events, edit owned events,  |
| (Event Owner / Club Lead)         | (Controlled provisioned role)      | view analytics, delegate staff.    |
|                                   |                                    | NO automatic gate scanner access.  |
+-----------------------------------+------------------------------------+------------------------------------+
| COORDINATOR                       | Event-Scoped Delegation            | Assigned events list, camera scan, |
| (Check-in Staff / Gate Volunteer) | (NOT a global role; any user)      | search query lookup, check in.     |
|                                   |                                    | NO event edit, NO global analytics.|
+-----------------------------------+------------------------------------+------------------------------------+
```

### Pure Two-Tier Global Roles + Live Delegation Rule
1. **Global Roles:** Strictly `ATTENDEE` and `ORGANIZER`.
2. **Coordinator is NOT a Global Role:** Any registered user (`ATTENDEE` or `ORGANIZER`) can be assigned as a coordinator for a specific event. The user's account role is never mutated.
3. **Event Scoping:** When an organizer assigns a coordinator, an item is created in `MarqueEventStaff` (`PK: eventId`, `SK: userId`).
4. **Zero Automatic Scanner Access:** Organizers do not automatically gain check-in permissions. To scan tickets, the organizer's own account must have a record in `MarqueEventStaff`.
5. **Immediate Revocation:** Deleting an assignment immediately invalidates check-in access on the subsequent request because the Lambda backend queries `MarqueEventStaff` directly.

---

## 3. Core Functional Capabilities

1. **Secure Campus Authentication:** Bcrypt password hashing (10 rounds) and stateless HMAC SHA-256 JWTs with 24-hour expiry.
2. **Atomic Email Uniqueness:** Transactional email locks in `MarqueUsers` eliminating GSI race conditions.
3. **Public Event Discovery:** Real-time text search and category filtering across published events.
4. **Organizer Studio & Ownership Floor:** Event creation and partial updates with automatic capacity reduction floors.
5. **Capacity-Safe RSVP Engine:** DynamoDB transactions with condition `confirmedCount < capacity` preventing overbooking.
6. **Deterministic FIFO Waitlist:** Strongly consistent base table ordering ensuring deterministic queue management.
7. **Safe Seat Cancellation & Promotion:** Atomic seat reclamation promoting the top waitlist candidate without losing seats or double-promoting.
8. **Tamper-Resistant Digital Passes:** QR codes containing strictly opaque ticket IDs (`tkt-xxx`) with zero embedded JWTs or credentials.
9. **Event-Scoped Check-in Gate:** WebRTC camera scanner and query-based manual lookup with atomic single-use verification.
10. **Role-Separated Analytics:** Full registration analytics for organizers; concise attendance counters for check-in staff.
