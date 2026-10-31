# Postman Setup & API Testing Guide

This guide explains how to import `docs/openapi.yaml` into Postman, configure test environments, manage JWT bearer tokens across different stakeholder personas, and test both happy paths and error scenarios (401, 403, 409).

---

## 1. Opening Postman & Importing the OpenAPI Spec

1. Launch the **Postman** desktop application (or web client at `https://web.postman.co`).
2. In the top-left navigation, click the **Import** button (or press `Ctrl + O` / `Cmd + O`).
3. Select **Files** and browse to the repository path:
   ```text
   docs/openapi.yaml
   ```
4. In the import preview modal:
   - Ensure the import format is recognized as **OpenAPI 3.1.0**.
   - Under **Import as**, select **Postman Collection** with the checkbox **Generate collection from OpenAPI specification** enabled.
5. Click **Import**. A collection named **`Marque Campus Event Management API`** will appear in your left sidebar.

---

## 2. Configuring the Postman Environment

To test against local mock, serverless offline, or the deployed AWS API Gateway stage, configure a dedicated Postman Environment.

1. In the left sidebar, click **Environments** $\rightarrow$ **+ (Create Environment)**.
2. Name the environment: **`Marque AWS Staging`** (or **`Marque Local Dev`**).
3. Add the following variables:

| Variable Name | Initial Value | Current Value | Description |
| :--- | :--- | :--- | :--- |
| `baseUrl` | `https://api.marque.campus.edu` | (Your API Gateway URL or `http://localhost:3000`) | Base API URL |
| `attendeeToken` | (leave empty initially) | (populated after attendee login) | JWT for Attendee persona |
| `organizerToken` | (leave empty initially) | (populated after organizer login) | JWT for Organizer persona |
| `coordinatorToken` | (leave empty initially) | (populated after staff login) | JWT for Coordinator persona |
| `eventId` | `evt-ccl-hackathon-2026` | `evt-ccl-hackathon-2026` | Test Event ID |
| `testTicketId` | `tkt-8f3a9e1b2c4d` | `tkt-8f3a9e1b2c4d` | Test Ticket ID |
| `coordinatorUserId` | (leave empty initially) | (populated from staff assign) | Coordinator User ID |

4. Click **Save** (`Ctrl + S`), and ensure the environment is selected in the top-right environment dropdown.

---

## 3. Configuring Authentication & Bearer Tokens

The OpenAPI specification defines the `BearerAuth` security scheme (`Authorization: Bearer <token>`).

### Method A: Collection-Level Token Inheritance (Recommended)
1. Right-click the **Marque Campus Event Management API** collection $\rightarrow$ **Edit**.
2. Switch to the **Authorization** tab.
3. Select **Type: Bearer Token**.
4. In the **Token** field, enter:
   ```text
   {{currentAuthToken}}
   ```
5. Click **Save**. All requests set to "Inherit auth from parent" will now use this active token.

### Method B: Automated Token Capture via Login Tests
In the **`POST /api/auth/login`** request, navigate to the **Tests** tab and add the following script:

```javascript
// Automatically extract token and user role after successful login
if (pm.response.code === 200) {
    const data = pm.response.json();
    pm.environment.set("currentAuthToken", data.token);

    if (data.user.role === "ORGANIZER") {
        pm.environment.set("organizerToken", data.token);
        console.log("Captured Organizer Token for: " + data.user.email);
    } else {
        pm.environment.set("attendeeToken", data.token);
        console.log("Captured Attendee Token for: " + data.user.email);
    }
}
```

---

## 4. Testing Happy Paths (Step-by-Step Persona Flows)

### Flow 1: Attendee Discovery & Free RSVP
1. **List Events:** Execute `GET {{baseUrl}}/api/events`. Verify `200 OK` and inspect event list.
2. **Attendee Sign-in:** Execute `POST {{baseUrl}}/api/auth/login` with attendee credentials.
3. **Register RSVP:** Execute `POST {{baseUrl}}/api/events/{{eventId}}/rsvp`.
   - Set Header: `Authorization: Bearer {{attendeeToken}}`.
   - Verify `201 Created` with status `CONFIRMED` and capture returned `ticketId`.
4. **Inspect Personal Digital Pass:** Execute `GET {{baseUrl}}/api/tickets/{{testTicketId}}`.
   - Verify `200 OK` and confirm status is `ACTIVE`.

### Flow 2: Organizer Studio & Coordinator Delegation
1. **Organizer Sign-in:** Execute `POST {{baseUrl}}/api/auth/login` with organizer credentials.
2. **Create Event:** Execute `POST {{baseUrl}}/api/events` with Header `Authorization: Bearer {{organizerToken}}`.
   - Verify `201 Created` and capture returned `eventId`.
3. **Assign Coordinator:** Execute `POST {{baseUrl}}/api/events/{{eventId}}/staff` with payload:
   ```json
   {
     "email": "coordinator.preeti@example.com"
   }
   ```
   - Verify `201 Created` with `permission: "CHECK_IN"`.

### Flow 3: Coordinator Venue Check-in
1. **Coordinator Sign-in:** Login as `coordinator.preeti@example.com`.
2. **List Assigned Events:** Execute `GET {{baseUrl}}/api/me/assigned-events`.
   - Verify `200 OK` and check that the assigned event appears in the list.
3. **Attendee Search:** Execute `GET {{baseUrl}}/api/events/{{eventId}}/attendees?q=chandrabhanu`.
   - Verify `200 OK` and note the masked email and active ticket ID.
4. **Execute Check-in:** Execute `POST {{baseUrl}}/api/events/{{eventId}}/check-in` with payload:
   ```json
   {
     "ticketId": "{{testTicketId}}"
   }
   ```
   - Verify `200 OK` with status `CHECKED_IN`, timestamp, and staff name.

---

## 5. Testing Error Conditions (401, 403, 409)

### Testing 401 Unauthorized
1. Open `POST /api/events` or `GET /api/me/rsvps`.
2. Set **Authorization** to **No Auth** (or send an invalid/expired token).
3. Send request.
4. **Expected Result:**
   - Status: `401 Unauthorized`
   - Body:
     ```json
     {
       "error": {
         "code": "UNAUTHORIZED",
         "message": "Authentication required. Please provide a valid Bearer token."
       }
     }
     ```

### Testing 403 Forbidden (RBAC Guardrail Tests)
1. **Attendee Attempting to Create Event:**
   - Send `POST /api/events` using `Authorization: Bearer {{attendeeToken}}`.
   - **Expected Result:** Status `403 Forbidden` (`FORBIDDEN`).
2. **Attendee Attempting Check-in:**
   - Send `POST /api/events/{{eventId}}/check-in` using `Authorization: Bearer {{attendeeToken}}`.
   - **Expected Result:** Status `403 Forbidden` (`FORBIDDEN`).
3. **Cross-Organizer Tampering:**
   - Organizer B attempts `PATCH /api/events/{{eventId}}` on an event owned by Organizer A.
   - **Expected Result:** Status `403 Forbidden` (`FORBIDDEN`).
4. **Unassigned Coordinator Check-in:**
   - Coordinator attempts check-in on an event where they have no record in `MarqueEventStaff`.
   - **Expected Result:** Status `403 Forbidden` (`FORBIDDEN`).

### Testing 409 Conflict (Concurrency & Idempotency)
1. **Duplicate RSVP:**
   - Execute `POST /api/events/{{eventId}}/rsvp` a second time with the same attendee token.
   - **Expected Result:** Status `409 Conflict` with code `DUPLICATE_REGISTRATION`.
2. **Duplicate Ticket Check-in:**
   - Execute `POST /api/events/{{eventId}}/check-in` with the same `ticketId` a second time.
   - **Expected Result:** Status `409 Conflict` with code `ALREADY_CHECKED_IN` displaying the original check-in timestamp and staff name.
3. **Duplicate Email Signup:**
   - Execute `POST /api/auth/register` with an already registered email.
   - **Expected Result:** Status `409 Conflict` with code `EMAIL_ALREADY_EXISTS`.

---

## 6. Organizing & Saving Request Presets

1. Create test folders inside Postman:
   - `01. Authentication`
   - `02. Attendee Discovery & RSVP`
   - `03. Organizer Event Studio`
   - `04. Coordinator Check-in Gate`
   - `05. Security & Edge Case Tests (401/403/409)`
2. Use the **Postman Collection Runner** to execute the entire test sequence sequentially and verify that all assertions pass automatically.

