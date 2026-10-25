# Project Overview

## 1. Purpose

Marque is a responsive web-based event management, free RSVP, and digital ticketing platform inspired by event platforms such as Bevy and the GDG event platform. It supports event discovery, registration, capacity management, waitlists, digital QR tickets, and venue check-in.

## 2. Stakeholders and roles

### Attendee
- Register and sign in.
- Browse, search, and filter published events.
- View event details and remaining capacity.
- RSVP for free, join a waitlist if full, and cancel an RSVP.
- View registration status and confirmed QR tickets.

### Organizer
- Create and edit events.
- Set title, description, category, date/time, venue, capacity, and optional banner.
- View attendee and waitlist lists.
- Monitor capacity and attendance statistics.

### Coordinator
- Select an event and scan ticket QR codes using a supported browser camera.
- Search by attendee name, registered email, or ticket reference when scanning is unavailable.
- Check a valid ticket in once and see clear validation results.

Roles are enforced in the backend. New accounts receive the Attendee role by default. Users cannot assign themselves Organizer or Coordinator roles.

## 3. Application type

Marque is a responsive web application, not a native Android/iOS app. It should work on desktop, laptop, tablet, and mobile browsers. Camera scanning requires a supported browser, user permission, and HTTPS. Vercel will provide HTTPS for the frontend deployment.

## 4. Functional requirements

1. Authentication using email/password and JWTs.
2. Public event listing, search, filtering, and event details.
3. Organizer-only event creation and editing.
4. Free RSVP with duplicate-registration prevention.
5. Capacity-safe booking so concurrent requests cannot overbook an event.
6. FIFO waitlist for full events.
7. Cancellation and automatic promotion of the next eligible waitlisted attendee.
8. Unique QR ticket for each confirmed registration.
9. Camera-based QR check-in.
10. Manual attendee/ticket lookup fallback.
11. Single-use check-in enforced by the backend.
12. Organizer statistics for capacity, confirmed RSVPs, waitlist, and attendance.

## 5. Out of scope for the MVP

- Payments or paid tickets.
- SMS or email notification delivery.
- Multiple campuses or tenant organizations.
- Native mobile apps.
- Complex analytics, real-time chat, or offline check-in synchronization.

## 6. Acceptance summary

The MVP is ready when a user can register/sign in, browse an event, RSVP or enter the waitlist, cancel and trigger promotion, display a QR ticket, and check in using either scanning or manual lookup. The core flow must work against the deployed AWS backend.
