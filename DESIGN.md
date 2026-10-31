# Marque Design System & Specification

This document outlines the visual identity, design tokens, component architecture, and interaction guidelines for **Marque** — a responsive campus event management, free RSVP, and digital QR-ticketing web application.

---

## 1. Design Direction & Philosophy

The Marque interface is inspired by modern, high-density developer and community event platforms (such as the GDG on Campus event management workspace), adapted into a distinctive and proprietary Marque brand identity.

### Principles:
- **Professional SaaS Precision**: Clean hierarchy, structured layouts, high information density without clutter, and purposeful whitespace.
- **Dark Graphite Canvas**: A dark aesthetic built on deep graphite and near-black surfaces (`#0D0E12`, `#14151B`, `#1B1D24`) that reduces eye strain and provides superior contrast for event artwork and statuses.
- **Restrained Accents**: Vibrant pink (`#F04F8B`) and energetic orange (`#FF984F`) used selectively for active navigation, key CTAs, and focal highlights.
- **Structure over Decoration**: Avoid gratuitous neon glows, excessive blur filters, or floating geometric shapes. Components use crisp 1px borders (`#30323C`) and subtle elevations.
- **Horizontal Event Geometry**: Event listings and management rows feature structured horizontal cards with event artwork aligned to the right on desktop displays, ensuring clear readability of metadata on the left.

---

## 2. Color Tokens

| Token Name | Hex Value | Usage |
| :--- | :--- | :--- |
| **Main Background** | `#0D0E12` | Primary application canvas |
| **Sidebar Background** | `#14151B` | Vertical left navigation drawer |
| **Card / Row Background** | `#1B1D24` | Event cards, data containers, and form panels |
| **Elevated Surface** | `#22252E` | Modals, dropdowns, and card hover states |
| **Border Default** | `#30323C` | Standard component and container separation borders |
| **Border Subtle** | `#242731` | Dividers, internal table rules, and secondary borders |
| **Text Primary** | `#F4F3F7` | Headings, card titles, and high-emphasis labels |
| **Text Secondary** | `#A5A4B0` | Body copy, timestamps, venues, and descriptions |
| **Text Muted** | `#727180` | Placeholder text, captions, and secondary icons |
| **Pink Accent** | `#F04F8B` | Primary interactive brand color, primary buttons, active tabs |
| **Orange Accent** | `#FF984F` | Secondary brand accent, highlights, waitlist notifications |
| **Success / Approved** | `#36C995` | Confirmed RSVPs, active passes, approved check-in scans |
| **Warning / Waitlist** | `#F0B65A` | FIFO waitlist queues, capacity warnings (>80%) |
| **Error / Cancelled** | `#F16D72` | Cancelled registrations, duplicate scans, validation errors |
| **Info / Checked In** | `#5B9BF3` | Checked-in attendee status, coordinator notices |

---

## 3. Typography

Marque uses two complementary typefaces:

- **Headings & Brand Display**: `Outfit` (weights: 600, 700, 800)
  - Geometric, clean sans-serif with slight character that gives Marque a modern campus identity.
  - Tracking: `-0.02em` to `-0.03em`.
- **Interface & Body Text**: `Plus Jakarta Sans` (weights: 400, 500, 600, 700)
  - Highly legible grotesque sans-serif engineered for dense user interfaces, data tables, and forms.

### Type Scale:
- `Page Title`: `1.5rem` / `24px` to `1.75rem` / `28px` (Font weight: 700)
- `Section Heading / Card Title`: `1.125rem` / `18px` to `1.25rem` / `20px` (Font weight: 600)
- `Subheading / Label`: `0.875rem` / `14px` (Font weight: 600, uppercase with letter-spacing `0.05em` where appropriate)
- `Body Text`: `0.9375rem` / `15px` (Line height: `1.55`)
- `Caption / Meta`: `0.8125rem` / `13px` to `0.75rem` / `12px` (Font weight: 500)
- `Monospace / Ticket IDs`: `SFMono-Regular`, `Consolas`, `monospace`

---

## 4. Application Shell & Layout Architecture

```text
+--------------------------------------------------------------------------+
|  SIDEBAR (#14151B)        |  TOP HEADER (#14151B)                       |
|  - Marque Emblem + Wordmark|  - Page Title / Subtitle                    |
|                           |  - Contextual Actions (e.g. + New Event)     |
|  - Discover Events        |  - User Profile & Role Indicator            |
|  - My RSVPs               +----------------------------------------------+
|  - Manage Events (Org)    |  WORKSPACE CANVAS (#0D0E12)                  |
|  - Check-in (Coord/Org)   |                                              |
|                           |  [ Filters & Search Controls ]               |
|  [ Help / Support ]       |                                              |
|                           |  +----------------------------------------+  |
|  - Profile & Role Demo    |  | Event Info / Metadata     |  Artwork   |  |
|  - Logout                 |  | Actions: Edit, View, ...  |  (Right)   |  |
|                           |  +----------------------------------------+  |
+--------------------------------------------------------------------------+
```

### 1. Left Sidebar:
- Width: `240px` (fixed on desktop, collapsible slide-over drawer on tablet/mobile).
- Background: `#14151B`, right border `1px solid #30323C`.
- Navigation items highlight with an active indicator strip and pink accent styling.
- Bottom area contains user session profile, quick demo role-switcher (only when `VITE_USE_MOCK_API=true`), and logout.

### 2. Top Header:
- Height: `64px`.
- Sticky positioning (`position: sticky; top: 0; z-index: 40`).
- Provides immediate orientation with clean typography.
- Houses contextual buttons (e.g., `+ New Event` on organizer pages).

### 3. Responsive Breakpoints:
- `Desktop`: `≥ 1024px` — Full persistent sidebar, horizontal card rows with 16:9 banner thumbnails.
- `Tablet`: `768px - 1023px` — Collapsible sidebar drawer, stacked search/filter bars.
- `Mobile`: `< 768px` — Hamburger header navigation, full-width vertical card stacking, touch-friendly tap targets (`≥ 44px`).

---

## 5. Component Patterns

### A. Horizontal Event Card / Row
- **Left Column**: Event title (linked), category pill, date & time (with calendar icon), venue (with pin icon), capacity progress meter, and availability badge.
- **Bottom Actions Bar**: Attendee view (`View Event`, `RSVP Free` / `Join Waitlist`) or Organizer view (`Edit`, `View Event`, `Attendees`, `Analytics`).
- **Right Column**: Fixed-ratio banner thumbnail (`190px x 120px` on desktop) with subtle border radius and fallback image handling.

### B. Capacity Progress Meter (`CapacityBar`)
- Visual track representing confirmed reservations against venue capacity:
  - `< 80%`: Safe green fill (`#36C995`)
  - `80% - 99%`: Warning amber fill (`#F0B65A`)
  - `100% (Full)`: Alert red fill (`#F16D72`) with "Waitlist Active" notice.

### C. Digital QR Pass (`QrTicketModal` & `/tickets/:ticketId`)
- Styled as a verified digital boarding pass.
- High-contrast QR code container containing **strictly the opaque ticket ID**.
- Ticket reference display, event date, venue, attendee verification stamp, and one-click Print/PDF save.

### D. Venue Check-in Scanner (`QrScanner`)
- Hardware camera stream within a bounded viewfinder.
- Clean stream termination and hardware release on component unmount or tab switch.
- Immediate manual search fallback on permission denial or optical failure.

---

## 6. Accessibility & Motion

- **Color Contrast**: All text tokens meet WCAG 2.1 AA standards (minimum 4.5:1 contrast ratio against card and surface backgrounds).
- **Reduced Motion**: All transitions adhere to `@media (prefers-reduced-motion: reduce)`.
- **Focus Rings**: Interactive elements feature a high-visibility `2px solid #F04F8B` outline on keyboard `:focus-visible`.

