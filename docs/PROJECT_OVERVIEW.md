# Project Overview

## 1. Purpose

Marque is a responsive web-based event management, free RSVP, and digital ticketing platform inspired by premier campus community platforms (such as Bevy and the GDG event platform). It provides strict separation across three core campus stakeholders: Participants (Attendees), Event Owners (Organizers), and Venue Check-in Staff (Coordinators). It supports event discovery, free registration, capacity management, FIFO waitlists, single-use digital QR tickets, and event-scoped venue check-in.

## 2. Stakeholders, Permissions and RBAC Architecture

Marque strictly defines three distinct stakeholder experiences with distinct boundaries:

### A. Attendee — Event Participant
The Attendee is a campus student, faculty member, or guest who discovers and attends events.
- **Allowed Capabilities:**
  - Register and sign in (public signups always receive `ATTENDEE` role).
  - Discover, search, and filter published campus events.
  - View event details, schedules, venue locations, and seat availability.
  - RSVP for free events; join a FIFO waitlist when an event is full.
  - Cancel their own active registrations and trigger FIFO promotion.
  - View their registrations on **My RSVPs** (`/my-registrations`), including confirmed status, waitlist position, or checked-in status.
  - Display their personal digital single-use QR pass (`/tickets/{ticketId}`).
- **Strict Restrictions:**
  - Attendees must **NEVER** have access to a QR scanner or check-in camera.
  - Attendees must **NEVER** access `/checkin` or `/organizer` routes (guarded by client and backend).
  - Attendees must **NEVER** search other attendees or perform check-ins.
  - Attendees must **NEVER** view organizer statistics or attendee registries.
  - The attendee's QR ticket functionality is strictly read-only for door admission.

### B. Organizer — Event Owner
The Organizer is a campus club lead, faculty coordinator, or student council head responsible for creating and operating events.
- **Allowed Capabilities:**
  - Create new campus events with title, description, category, datetime, venue, and capacity.
  - Edit only the events they own (`organizerId === user.userId`).
  - View attendee registries and attendance analytics for their own events.
  - **Assign and revoke Coordinators (`MarqueEventStaff`)** for their specific events by campus email.
  - View check-in statistics, capacity utilization, and FIFO waitlist counts.
- **Strict Restrictions:**
  - Organizers **cannot** edit, cancel, or reassign events owned by other organizers.
  - Organizers do not automatically gain global venue scanning access; check-in permissions are event-scoped.

### C. Coordinator — Event Check-in Staff
The Coordinator is trusted student volunteer staff assigned to operate admission gates at the venue.
- **Allowed Capabilities:**
  - View the list of **Assigned Events** (`/checkin`) where their email was explicitly registered by the event organizer.
  - Open the dedicated check-in workspace for assigned events.
  - Scan attendee ticket QR codes using the device/browser camera.
  - Perform manual attendee/ticket lookups using name, email, or opaque ticket ID.
  - Execute atomic, single-use check-ins that verify `ACTIVE` status and prevent duplicates.
  - Receive clear visual and auditory feedback (success chime vs. error tone).
- **Strict Restrictions:**
  - Coordinators **cannot** create or edit events, alter capacities, or delete events.
  - Coordinators **cannot** access unassigned events or scan tickets for events they were not assigned to.
  - Coordinators **cannot** access the organizer dashboard (`/organizer`).
  - Coordinators **cannot** reassign staff or view system-wide user credentials.

Roles are strictly validated by backend authorization headers and event-staff assignment tables (`MarqueEventStaff`). Client-side route guards prevent unauthorized UI exposure, while backend API Gateway / Lambda handlers enforce authorization on every request.

## 3. Application Type

Marque is a high-performance responsive Single Page Application (SPA) built with React 18, Vite, and modern CSS design tokens, backed by a serverless AWS REST API (API Gateway + AWS Lambda + DynamoDB). It is optimized for mobile, tablet, and desktop viewports. Camera scanning operates via HTML5/WebRTC media streams over HTTPS.

## 4. Functional Requirements

1. **Secure Campus Authentication:** Email/password authentication issuing stateless HMAC SHA-256 JWTs with role claims (`ATTENDEE`, `ORGANIZER`, `COORDINATOR`).
2. **Public Event Discovery:** Filter by category (`Technology`, `Workshop`, `Cultural`, `Academic`, `Sports`) and live text search across titles and venues.
3. **Organizer Event Studio:** Dedicated management console with capacity limits and coordinator delegation.
4. **Capacity-Safe RSVP Engine:** DynamoDB conditional writes (`confirmedCount < capacity`) preventing concurrent overbooking.
5. **FIFO Queue Waitlist:** Automatic placement in numbered queue when capacity is reached.
6. **Cancellation & FIFO Promotion:** Instant seat reclamation and promotion of the earliest waitlisted participant.
7. **Single-Use Digital Passes:** High-contrast QR codes encoding strictly opaque ticket IDs (`tkt-xxxxxxxx`).
8. **Camera & Manual Check-in Workspace:** WebRTC camera scanner with fallback to manual search by attendee name or ticket ID.
9. **Event Staff Delegation:** Organizers assign check-in volunteers per event, stored in `MarqueEventStaff`.
10. **Live Attendance Turnout Metrics:** Real-time visibility into capacity, active RSVPs, waitlist length, and checked-in counts.

## 5. Out of Scope for MVP

- Payments or paid ticketing tiers.
- External SMS/WhatsApp notification delivery.
- Multi-campus tenant isolation.
- Native mobile app binaries (App Store/Play Store).
- Offline check-in caching and synchronization.

## 6. Acceptance Summary

The system is complete when:
- Attendees can browse, register, waitlist, cancel, and display their personal QR tickets without seeing any scanning or organizer tools.
- Organizers can create events, monitor attendee rosters, view live statistics, and delegate coordinators by email.
- Coordinators see only their assigned events, operate the scanner and manual lookup, and execute single-use check-in.
- Security tests confirm that privilege escalation and cross-event operations are rejected.
