# Architecture — Final & Frozen Design

## 1. High-Level System Architecture

```mermaid
flowchart TD
    subgraph Clients["Frontend Layer (Vercel / HTTPS)"]
        A["Attendee Client"] -->|Browse, RSVP, Display Pass| SPA["React + Vite SPA"]
        O["Organizer Client"] -->|Create, Edit, Delegate Staff, Analytics| SPA
        C["Coordinator Client"] -->|Assigned Events, Camera Scan, Check-in| SPA
    end

    SPA -->|HTTPS REST API + Bearer JWT| APIGW["Amazon API Gateway (HTTP API)"]

    subgraph AWS["Serverless Cloud Architecture"]
        APIGW --> Router["marque-api: Express / Lambda Router"]
        Router --> AuthM["authMiddleware (Verify JWT & Role)"]
        AuthM --> Handlers["Handler Controllers"]
        Handlers --> Services["Domain Services"]
        Services --> Repos["DynamoDB Repositories"]
        Repos --> DDB[("Amazon DynamoDB (On-Demand)")]
        Services --> S3[("Amazon S3: Event Banners")]
    end

    subgraph Tables["DynamoDB Tables (ACID & Strongly Consistent)"]
        DDB --> T1["MarqueUsers (Profiles & Email Locks)"]
        DDB --> T2["MarqueEvents (Capacities & Schedules)"]
        DDB --> T3["MarqueEventStaff (Event-Scoped Permissions)"]
        DDB --> T4["MarqueRSVPs (Attendee Registrations)"]
        DDB --> T5["MarqueWaitlist (FIFO Base Table Queue)"]
        DDB --> T6["MarqueTickets (Opaque Passes & Check-in Logs)"]
    end
```

The system is organized into a clean separation of concerns:
1. **Frontend Presentation:** React 18 SPA hosted on Vercel over TLS 1.3. Communicates with AWS via a typed API client with zero client-side privilege assumptions.
2. **API Gateway:** Amazon API Gateway HTTP API routing all `/api/*` traffic to a single monolithic serverless AWS Lambda function (`marque-api`).
3. **Application Routing & Middleware:** A modular Node.js router that validates request bodies, unpacks Bearer JWTs, and verifies global roles and event-specific check-in permissions.
4. **Data Persistence:** DynamoDB on-demand tables executing multi-item atomic transactions (`TransactWriteItems`) for capacity allocation and seat reclamation.
5. **Asset Storage:** Private Amazon S3 bucket for optional event banner graphics accessed via presigned upload URLs.

---

## 2. Stakeholder Permissions & Authorization Flow

```mermaid
flowchart LR
    subgraph Roles["Global Account Roles (in JWT)"]
        ATT["ATTENDEE (Default)"]
        ORG["ORGANIZER (Provisioned)"]
    end

    subgraph Scope["Authorization Checks"]
        ATT -->|Can RSVP & View Own Pass| PublicAPIs["Public & Attendee Endpoints"]
        ORG -->|Owns eventId?| OrgAPIs["Event Management & Staff Delegation"]
        ATT & ORG -->|In MarqueEventStaff for eventId?| StaffAPIs["Venue Check-in Workspace & Scanner"]
    end

    subgraph Endpoints["Target Action"]
        PublicAPIs --> E1["RSVP / Waitlist / View Ticket"]
        OrgAPIs --> E2["Create/Edit Event, Delegate Staff, View Stats"]
        StaffAPIs --> E3["Scan Ticket, Search Attendees, Check-in"]
    end
```

### Pure Two-Tier Global Roles + Event Delegation Rule
1. **Global Roles:** Only `ATTENDEE` and `ORGANIZER` exist as persistent account roles in `MarqueUsers` and JWT claims.
2. **Coordinator is NOT a Global Role:** Any registered user (`ATTENDEE` or `ORGANIZER`) can be assigned as a coordinator for a specific event. The user's account role is never mutated.
3. **Event Scoping:** When an organizer assigns a coordinator, an item is created in `MarqueEventStaff` (`PK: eventId`, `SK: userId`).
4. **Zero Automatic Scanner Access:** Organizers do not automatically gain check-in permissions. To scan tickets, the organizer's own account must have a record in `MarqueEventStaff`.
5. **Immediate Revocation:** Deleting an assignment immediately invalidates check-in access on the subsequent request because the Lambda backend queries `MarqueEventStaff` directly.

---

## 3. RSVP, Capacity & FIFO Waitlist Concurrency Flow

```mermaid
sequenceDiagram
    autonumber
    actor A as Attendee
    participant GW as API Gateway / Lambda
    participant DDB as DynamoDB (TransactWriteItems)
    participant WL as MarqueWaitlist Base Table

    A->>GW: POST /api/events/{eventId}/rsvp
    GW->>DDB: TransactWriteItems: Increment confirmedCount IF confirmedCount < capacity
    alt Capacity Available
        DDB-->>GW: Transaction Succeeded
        GW-->>A: 201 Created { status: 'CONFIRMED', ticketId: 'tkt-xxx' }
    else Event Full (ConditionFailed)
        GW->>WL: PutItem: queueKey = NOW#userId, status = 'WAITING'
        GW-->>A: 200 OK { status: 'WAITLISTED', queuePosition: N }
    end

    Note over A, WL: Cancellation & Safe Promotion
    actor C as Confirmed Attendee
    C->>GW: DELETE /api/events/{eventId}/rsvp
    GW->>WL: Query oldest WAITING entry (Strongly Consistent Read)
    alt Waitlisted Candidate Found
        GW->>DDB: TransactWriteItems: Cancel old RSVP/ticket, Promote candidate IF status == 'WAITING'
        DDB-->>GW: Transaction Succeeded (Capacity count unchanged)
        GW-->>C: 200 OK { promotedAttendee: 'Aarav Sharma' }
    else Waitlist Empty
        GW->>DDB: TransactWriteItems: Cancel RSVP/ticket, Decrement confirmedCount
        DDB-->>GW: Transaction Succeeded
        GW-->>C: 200 OK
    end
```

---

## 4. Single-Use Venue Check-In Architecture

```mermaid
sequenceDiagram
    autonumber
    actor Coord as Check-in Coordinator
    participant FE as React Check-in Workspace
    participant GW as API Gateway / Lambda
    participant Staff as MarqueEventStaff
    participant Tkt as MarqueTickets

    Coord->>FE: Scan Attendee QR Code
    FE->>GW: POST /api/events/{eventId}/check-in { ticketId: 'tkt-8f3a9e1b2c4d' }
    GW->>Staff: GetItem: PK=eventId, SK=caller.userId
    alt Not in Staff Table
        GW-->>FE: 403 Forbidden (NOT_ASSIGNED_STAFF)
    else Authorized Staff
        GW->>Tkt: UpdateItem: SET status = 'CHECKED_IN' WHERE eventId = :e AND status = 'ACTIVE'
        alt Status was ACTIVE
            Tkt-->>GW: Success
            GW-->>FE: 200 OK { status: 'CHECKED_IN', attendeeName: '...' }
            FE-->>Coord: Green chime & verified screen
        else Already CHECKED_IN
            Tkt-->>GW: ConditionFailed
            GW-->>FE: 409 Conflict (ALREADY_CHECKED_IN)
            FE-->>Coord: Red error tone & duplicate scan alert
        end
    end
```

---

## 5. Table to Access Pattern Mapping

| Table / GSI | Primary Access Patterns Serviced | Consistency Mode |
| :--- | :--- | :--- |
| `MarqueUsers` (`userId` + `itemType`) | AP-02 (User Profile), AP-01 via Email Locks | Strongly Consistent |
| `MarqueUsers.email-index` | AP-01 (Normalized Email Lookup during Login / Staff Assignment) | Eventually Consistent |
| `MarqueEvents` (`eventId`) | AP-04 (Event Details), Capacity Conditional Updates | Strongly Consistent |
| `MarqueEvents.status-startAt-index` | AP-03 (Public Event Discovery & Filtering) | Eventually Consistent |
| `MarqueEvents.organizer-index` | AP-05 (Organizer Dashboard Events List) | Eventually Consistent |
| `MarqueEventStaff` (`eventId` + `userId`) | AP-06 (List Event Staff), AP-07 (Staff Check-in Verification) | Strongly Consistent |
| `MarqueEventStaff.user-assigned-events-index` | AP-08 (List Events Assigned to User) | Eventually Consistent |
| `MarqueRSVPs` (`eventId` + `attendeeId`) | AP-10 (Check Attendee RSVP Status), Duplicate Prevention | Strongly Consistent |
| `MarqueRSVPs.attendee-index` | AP-09 (My RSVPs Registrations List) | Eventually Consistent |
| `MarqueWaitlist` (`eventId` + `queueKey`) | AP-11 (Oldest Waitlist FIFO Candidate Query for Promotion) | **Strongly Consistent** |
| `MarqueWaitlist.attendee-waitlist-index` | Locate User Queue Item on Self-Cancellation | Eventually Consistent |
| `MarqueTickets` (`ticketId`) | AP-12 (Single Ticket Query), AP-14 (Atomic Check-in) | Strongly Consistent |
| `MarqueTickets.event-attendees-index` | AP-13 (Attendee Registry Search for Check-in Staff) | Eventually Consistent |

---

## 6. Deployment Boundaries & Infrastructure Wiring

- **Frontend Hosting:** Vercel over TLS 1.3. Environment variable `VITE_API_BASE_URL` points directly to the deployed API Gateway HTTP API stage endpoint.
- **Backend Execution:** Serverless Node.js 22.x Lambda function fronted by Amazon API Gateway HTTP API with CORS configuration matching the Vercel domain.
- **Persistence Layer:** Amazon DynamoDB on-demand pay-per-request tables with point-in-time recovery (PITR) enabled.
- **Media Storage:** Amazon S3 private bucket for organizer banner graphics configured with Block Public Access and short-lived presigned upload URLs.
