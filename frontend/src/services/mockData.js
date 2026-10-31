/**
 * Isolated Mock Adapter for Marque MVP.
 * Simulates the AWS Lambda / DynamoDB backend strictly adhering to API_CONTRACT.md.
 * Used when VITE_API_BASE_URL is not configured or backend is unavailable.
 * Can be cleanly decoupled or removed once AWS deployment is live.
 */

// Initial mock events
let mockEvents = [
  {
    eventId: 'evt-ccl-hackathon-2026',
    title: 'Cloud Canvas 2026: Campus Hackathon',
    description: '48-hour premier cloud computing and web architecture hackathon at VESIT. Build, deploy serverless architectures on AWS, and pitch to industry judges.',
    category: 'Technology',
    startAt: '2026-11-15T09:00:00Z',
    endAt: '2026-11-17T17:00:00Z',
    venue: 'Auditorium & Lab 502, VESIT Campus',
    capacity: 100,
    confirmedCount: 88,
    status: 'PUBLISHED',
    organizerId: 'usr-organizer-01',
    bannerUrl: 'https://images.unsplash.com/photo-1504384308090-c894fdcc538d?auto=format&fit=crop&w=1200&q=80',
    createdAt: '2026-10-01T10:00:00Z',
  },
  {
    eventId: 'evt-gdg-devfest',
    title: 'GDG Campus DevFest: AI & Web3 Summit',
    description: 'Explore the frontiers of Generative AI, modern frontend web frameworks, and cloud-native solutions with expert speakers from Google and industry leaders.',
    category: 'Workshop',
    startAt: '2026-11-22T10:00:00Z',
    endAt: '2026-11-22T18:00:00Z',
    venue: 'Amphitheatre, Central Block',
    capacity: 50,
    confirmedCount: 50, // Full event to demonstrate waitlist!
    status: 'PUBLISHED',
    organizerId: 'usr-organizer-01',
    bannerUrl: 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?auto=format&fit=crop&w=1200&q=80',
    createdAt: '2026-10-05T12:00:00Z',
  },
  {
    eventId: 'evt-utsav-cultural-night',
    title: 'Utsav: Annual Cultural Symphony 2026',
    description: 'An evening of classical and contemporary musical performances, theatrical drama, and dynamic dance spectacles presented by the Cultural Council.',
    category: 'Cultural',
    startAt: '2026-12-05T18:00:00Z',
    endAt: '2026-12-05T22:30:00Z',
    venue: 'Main Ground & Open Stage',
    capacity: 250,
    confirmedCount: 142,
    status: 'PUBLISHED',
    organizerId: 'usr-organizer-02',
    bannerUrl: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=1200&q=80',
    createdAt: '2026-10-10T14:00:00Z',
  },
  {
    eventId: 'evt-react-vite-masterclass',
    title: 'Zero-to-Production: Full-Stack React & AWS Workshop',
    description: 'Hands-on practical session building high-performance SPAs with React, Vite, serverless Node.js Lambda backends, and DynamoDB conditional writes.',
    category: 'Workshop',
    startAt: '2026-11-28T14:00:00Z',
    endAt: '2026-11-28T17:00:00Z',
    venue: 'Seminar Hall B, IT Building',
    capacity: 40,
    confirmedCount: 25,
    status: 'PUBLISHED',
    organizerId: 'usr-organizer-01',
    bannerUrl: 'https://images.unsplash.com/photo-1517694712202-14dd9538aa97?auto=format&fit=crop&w=1200&q=80',
    createdAt: '2026-10-15T09:00:00Z',
  },
  {
    eventId: 'evt-ccl-research-symposium',
    title: 'National Cloud & Distributed Systems Symposium',
    description: 'Faculty and student peer-reviewed research presentations on edge computing, serverless scalability, and distributed cloud ledger mechanisms.',
    category: 'Academic',
    startAt: '2026-12-10T10:00:00Z',
    endAt: '2026-12-10T16:30:00Z',
    venue: 'Conference Hall 1, Central Library',
    capacity: 75,
    confirmedCount: 42,
    status: 'PUBLISHED',
    organizerId: 'usr-organizer-02',
    bannerUrl: 'https://images.unsplash.com/photo-1434030216411-0b793f4b4173?auto=format&fit=crop&w=1200&q=80',
    createdAt: '2026-10-16T11:00:00Z',
  }
];

// Initial mock staff (MarqueEventStaff representation)
let mockEventStaff = [
  {
    eventId: 'evt-ccl-hackathon-2026',
    userId: 'usr-coordinator-01',
    email: 'coordinator.preeti@example.com',
    name: 'Preeti Coordinator',
    role: 'COORDINATOR',
    assignedAt: '2026-10-12T10:00:00Z',
    assignedBy: 'usr-organizer-01',
  }
];

// Registered mock users database for lookup / assignment
let mockUsers = [
  {
    userId: 'usr-attendee-demo',
    email: 'chandrabhanu@example.com',
    name: 'Chandrabhanu Prusty',
    role: 'ATTENDEE',
  },
  {
    userId: 'usr-organizer-01',
    email: 'organizer.neilsen@example.com',
    name: 'Neilsen Organizer',
    role: 'ORGANIZER',
  },
  {
    userId: 'usr-organizer-02',
    email: 'organizer.council@example.com',
    name: 'Council Lead',
    role: 'ORGANIZER',
  },
  {
    userId: 'usr-coordinator-01',
    email: 'coordinator.preeti@example.com',
    name: 'Preeti Coordinator',
    role: 'COORDINATOR',
  },
  {
    userId: 'usr-coordinator-02',
    email: 'coordinator.samir@example.com',
    name: 'Samir Coordinator',
    role: 'COORDINATOR',
  }
];

// Initial mock RSVPs & Tickets
let mockRsvps = [
  {
    rsvpId: 'rsvp-demo-1',
    eventId: 'evt-ccl-hackathon-2026',
    attendeeId: 'usr-attendee-demo',
    status: 'CONFIRMED',
    ticketId: 'tkt-8f3a9e1b2c4d',
    createdAt: '2026-10-18T10:00:00Z',
    updatedAt: '2026-10-18T10:00:00Z',
  },
  {
    rsvpId: 'rsvp-demo-2',
    eventId: 'evt-gdg-devfest',
    attendeeId: 'usr-attendee-demo',
    status: 'WAITLISTED',
    queuePosition: 1,
    createdAt: '2026-10-19T14:30:00Z',
    updatedAt: '2026-10-19T14:30:00Z',
  }
];

let mockTickets = [
  {
    ticketId: 'tkt-8f3a9e1b2c4d',
    eventId: 'evt-ccl-hackathon-2026',
    attendeeId: 'usr-attendee-demo',
    attendeeName: 'Chandrabhanu Prusty',
    attendeeEmail: 'chandrabhanu@example.com',
    eventTitle: 'Cloud Canvas 2026: Campus Hackathon',
    eventVenue: 'Auditorium & Lab 502, VESIT Campus',
    eventStartAt: '2026-11-15T09:00:00Z',
    status: 'ACTIVE',
    issuedAt: '2026-10-18T10:00:00Z',
    checkedInAt: null,
    checkedInBy: null,
  },
  {
    ticketId: 'tkt-sample-coordinator-lookup',
    eventId: 'evt-ccl-hackathon-2026',
    attendeeId: 'usr-attendee-02',
    attendeeName: 'Aarav Sharma',
    attendeeEmail: 'aarav.sharma@example.com',
    eventTitle: 'Cloud Canvas 2026: Campus Hackathon',
    eventVenue: 'Auditorium & Lab 502, VESIT Campus',
    eventStartAt: '2026-11-15T09:00:00Z',
    status: 'ACTIVE',
    issuedAt: '2026-10-18T11:20:00Z',
    checkedInAt: null,
    checkedInBy: null,
  },
  {
    ticketId: 'tkt-sample-already-checked',
    eventId: 'evt-ccl-hackathon-2026',
    attendeeId: 'usr-attendee-03',
    attendeeName: 'Priya Iyer',
    attendeeEmail: 'priya.iyer@example.com',
    eventTitle: 'Cloud Canvas 2026: Campus Hackathon',
    eventVenue: 'Auditorium & Lab 502, VESIT Campus',
    eventStartAt: '2026-11-15T09:00:00Z',
    status: 'CHECKED_IN',
    issuedAt: '2026-10-18T09:15:00Z',
    checkedInAt: '2026-11-15T09:15:00Z',
    checkedInBy: 'usr-coordinator-01',
  }
];

let mockWaitlist = [
  {
    eventId: 'evt-gdg-devfest',
    attendeeId: 'usr-attendee-demo',
    attendeeName: 'Chandrabhanu Prusty',
    attendeeEmail: 'chandrabhanu@example.com',
    queueKey: '2026-10-19T14:30:00Z#usr-attendee-demo',
    queuePosition: 1,
    status: 'WAITING',
    createdAt: '2026-10-19T14:30:00Z',
  }
];

// Helper to simulate network latency for realistic UX states
const delay = (ms = 180) => new Promise(res => setTimeout(res, ms));

export const mockBackend = {
  // Events
  async getEvents({ q, category } = {}) {
    await delay();
    let results = [...mockEvents];
    if (q) {
      const lower = q.toLowerCase();
      results = results.filter(e => 
        e.title.toLowerCase().includes(lower) || 
        e.description.toLowerCase().includes(lower) ||
        e.venue.toLowerCase().includes(lower)
      );
    }
    if (category && category !== 'All') {
      results = results.filter(e => e.category.toLowerCase() === category.toLowerCase());
    }
    return { events: results };
  },

  async getEventById(eventId) {
    await delay();
    const event = mockEvents.find(e => e.eventId === eventId);
    if (!event) {
      throw { status: 404, error: { code: 'EVENT_NOT_FOUND', message: 'Event not found.' } };
    }
    return { event };
  },

  async createEvent(eventData, user) {
    await delay();
    if (user?.role !== 'ORGANIZER') {
      throw { status: 403, error: { code: 'FORBIDDEN', message: 'Only organizers can create events.' } };
    }
    const newEvent = {
      eventId: `evt-${Date.now().toString(36)}`,
      ...eventData,
      capacity: Number(eventData.capacity),
      confirmedCount: 0,
      status: 'PUBLISHED',
      organizerId: user.userId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    mockEvents.unshift(newEvent);
    return { event: newEvent };
  },

  async updateEvent(eventId, eventData, user) {
    await delay();
    if (user?.role !== 'ORGANIZER') {
      throw { status: 403, error: { code: 'FORBIDDEN', message: 'Only organizers can edit events.' } };
    }
    const idx = mockEvents.findIndex(e => e.eventId === eventId);
    if (idx === -1) {
      throw { status: 404, error: { code: 'EVENT_NOT_FOUND', message: 'Event not found.' } };
    }
    const existing = mockEvents[idx];
    if (existing.organizerId !== user.userId) {
      throw { status: 403, error: { code: 'FORBIDDEN', message: 'Organizers can only edit events they own.' } };
    }
    if (eventData.capacity !== undefined && Number(eventData.capacity) < existing.confirmedCount) {
      throw { status: 400, error: { code: 'INVALID_CAPACITY', message: `Cannot reduce capacity below confirmed attendees (${existing.confirmedCount}).` } };
    }
    mockEvents[idx] = { ...existing, ...eventData, updatedAt: new Date().toISOString() };
    return { event: mockEvents[idx] };
  },

  // Event Staff / Coordinator Management
  async getEventStaff(eventId, user) {
    await delay();
    const event = mockEvents.find(e => e.eventId === eventId);
    if (!event) {
      throw { status: 404, error: { code: 'EVENT_NOT_FOUND', message: 'Event not found.' } };
    }
    // Only the event organizer can view staff list
    if (user?.role !== 'ORGANIZER' || event.organizerId !== user?.userId) {
      throw { status: 403, error: { code: 'FORBIDDEN', message: 'Only the event owner can view assigned coordinators.' } };
    }
    const staff = mockEventStaff.filter(s => s.eventId === eventId);
    return { staff };
  },

  async assignCoordinator(eventId, email, user) {
    await delay();
    const event = mockEvents.find(e => e.eventId === eventId);
    if (!event) {
      throw { status: 404, error: { code: 'EVENT_NOT_FOUND', message: 'Event not found.' } };
    }
    if (user?.role !== 'ORGANIZER' || event.organizerId !== user?.userId) {
      throw { status: 403, error: { code: 'FORBIDDEN', message: 'Only the event owner can assign coordinators.' } };
    }
    const cleanEmail = (email || '').trim().toLowerCase();
    if (!cleanEmail) {
      throw { status: 400, error: { code: 'INVALID_EMAIL', message: 'Coordinator email is required.' } };
    }

    // Check if already assigned
    const existing = mockEventStaff.find(s => s.eventId === eventId && s.email.toLowerCase() === cleanEmail);
    if (existing) {
      throw { status: 409, error: { code: 'ALREADY_ASSIGNED', message: 'User is already assigned as a coordinator for this event.' } };
    }

    // Lookup user in mockUsers or create coordinator record
    let foundUser = mockUsers.find(u => u.email.toLowerCase() === cleanEmail);
    if (!foundUser) {
      foundUser = {
        userId: `usr-coord-${Date.now().toString(36)}`,
        email: cleanEmail,
        name: cleanEmail.split('@')[0].replace(/[._-]/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
        role: 'COORDINATOR',
      };
      mockUsers.push(foundUser);
    }

    const assignment = {
      eventId,
      userId: foundUser.userId,
      email: foundUser.email,
      name: foundUser.name,
      role: 'COORDINATOR',
      assignedAt: new Date().toISOString(),
      assignedBy: user.userId,
    };
    mockEventStaff.push(assignment);
    return { assignment };
  },

  async removeCoordinator(eventId, userId, user) {
    await delay();
    const event = mockEvents.find(e => e.eventId === eventId);
    if (!event) {
      throw { status: 404, error: { code: 'EVENT_NOT_FOUND', message: 'Event not found.' } };
    }
    if (user?.role !== 'ORGANIZER' || event.organizerId !== user?.userId) {
      throw { status: 403, error: { code: 'FORBIDDEN', message: 'Only the event owner can remove coordinators.' } };
    }
    const idx = mockEventStaff.findIndex(s => s.eventId === eventId && s.userId === userId);
    if (idx === -1) {
      throw { status: 404, error: { code: 'STAFF_NOT_FOUND', message: 'Coordinator assignment not found.' } };
    }
    mockEventStaff.splice(idx, 1);
    return { message: 'Coordinator removed successfully.' };
  },

  async getAssignedEvents(user) {
    await delay();
    if (!user) {
      throw { status: 401, error: { code: 'UNAUTHORIZED', message: 'Sign in required.' } };
    }
    // Find all events where this user is assigned in mockEventStaff
    const assignedIds = mockEventStaff.filter(s => s.userId === user.userId).map(s => s.eventId);
    // Organizers also have access to events they own
    const ownedIds = mockEvents.filter(e => e.organizerId === user.userId).map(e => e.eventId);
    const combinedIds = Array.from(new Set([...assignedIds, ...ownedIds]));

    const assignedEvents = mockEvents.filter(e => combinedIds.includes(e.eventId));
    return { events: assignedEvents };
  },

  // RSVP & Registration
  async rsvpEvent(eventId, user) {
    await delay();
    if (!user) {
      throw { status: 401, error: { code: 'UNAUTHORIZED', message: 'Sign in to register.' } };
    }
    const event = mockEvents.find(e => e.eventId === eventId);
    if (!event) {
      throw { status: 404, error: { code: 'EVENT_NOT_FOUND', message: 'Event not found.' } };
    }

    // Check duplicate
    const existingRsvp = mockRsvps.find(r => r.eventId === eventId && r.attendeeId === user.userId && r.status !== 'CANCELLED');
    if (existingRsvp) {
      throw { status: 409, error: { code: 'DUPLICATE_REGISTRATION', message: 'You have already registered for this event.' } };
    }

    const rsvpId = `rsvp-${Date.now().toString(36)}`;

    // Check capacity
    if (event.confirmedCount < event.capacity) {
      // Confirmed registration
      event.confirmedCount += 1;
      const ticketId = `tkt-${Math.random().toString(36).substring(2, 10)}${Math.random().toString(36).substring(2, 6)}`;
      const newRsvp = {
        rsvpId,
        eventId,
        attendeeId: user.userId,
        status: 'CONFIRMED',
        ticketId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      mockRsvps.unshift(newRsvp);

      const newTicket = {
        ticketId,
        eventId,
        attendeeId: user.userId,
        attendeeName: user.name || 'Campus Attendee',
        attendeeEmail: user.email,
        eventTitle: event.title,
        eventVenue: event.venue,
        eventStartAt: event.startAt,
        status: 'ACTIVE',
        issuedAt: new Date().toISOString(),
        checkedInAt: null,
        checkedInBy: null,
      };
      mockTickets.push(newTicket);

      return {
        status: 'CONFIRMED',
        rsvpId,
        ticketId,
      };
    } else {
      // Event full -> enter waitlist
      const eventWaitlist = mockWaitlist.filter(w => w.eventId === eventId && w.status === 'WAITING');
      const queuePosition = eventWaitlist.length + 1;
      const newWaitlist = {
        eventId,
        attendeeId: user.userId,
        attendeeName: user.name,
        attendeeEmail: user.email,
        queueKey: `${new Date().toISOString()}#${user.userId}`,
        queuePosition,
        status: 'WAITING',
        createdAt: new Date().toISOString(),
      };
      mockWaitlist.push(newWaitlist);

      const newRsvp = {
        rsvpId,
        eventId,
        attendeeId: user.userId,
        status: 'WAITLISTED',
        queuePosition,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      mockRsvps.unshift(newRsvp);

      return {
        status: 'WAITLISTED',
        rsvpId,
        queuePosition,
      };
    }
  },

  async cancelRsvp(eventId, user) {
    await delay();
    if (!user) {
      throw { status: 401, error: { code: 'UNAUTHORIZED', message: 'Sign in required.' } };
    }
    const rsvpIdx = mockRsvps.findIndex(r => r.eventId === eventId && r.attendeeId === user.userId && r.status !== 'CANCELLED');
    if (rsvpIdx === -1) {
      throw { status: 404, error: { code: 'RSVP_NOT_FOUND', message: 'Active registration not found.' } };
    }
    const prevStatus = mockRsvps[rsvpIdx].status;
    const oldTicketId = mockRsvps[rsvpIdx].ticketId;
    mockRsvps[rsvpIdx].status = 'CANCELLED';
    mockRsvps[rsvpIdx].updatedAt = new Date().toISOString();

    if (oldTicketId) {
      const tkt = mockTickets.find(t => t.ticketId === oldTicketId);
      if (tkt) tkt.status = 'CANCELLED';
    }

    const event = mockEvents.find(e => e.eventId === eventId);
    let promotedAttendee = null;

    if (prevStatus === 'CONFIRMED' && event) {
      // Check for waiting attendees in FIFO order
      const waiting = mockWaitlist.filter(w => w.eventId === eventId && w.status === 'WAITING')
        .sort((a, b) => a.queueKey.localeCompare(b.queueKey));

      if (waiting.length > 0) {
        const nextInLine = waiting[0];
        nextInLine.status = 'PROMOTED';

        // Update attendee's RSVP from WAITLISTED to CONFIRMED
        const targetRsvp = mockRsvps.find(r => r.eventId === eventId && r.attendeeId === nextInLine.attendeeId && r.status === 'WAITLISTED');
        const promotedTicketId = `tkt-${Math.random().toString(36).substring(2, 10)}${Math.random().toString(36).substring(2, 6)}`;
        if (targetRsvp) {
          targetRsvp.status = 'CONFIRMED';
          targetRsvp.ticketId = promotedTicketId;
          targetRsvp.updatedAt = new Date().toISOString();
        }

        mockTickets.push({
          ticketId: promotedTicketId,
          eventId,
          attendeeId: nextInLine.attendeeId,
          attendeeName: nextInLine.attendeeName,
          attendeeEmail: nextInLine.attendeeEmail,
          eventTitle: event.title,
          eventVenue: event.venue,
          eventStartAt: event.startAt,
          status: 'ACTIVE',
          issuedAt: new Date().toISOString(),
          checkedInAt: null,
          checkedInBy: null,
        });

        promotedAttendee = nextInLine.attendeeName;
        // Capacity count remains unchanged as seat transferred
      } else {
        if (event.confirmedCount > 0) {
          event.confirmedCount -= 1;
        }
      }
    }

    return {
      message: 'Registration successfully cancelled.',
      promotedAttendee,
    };
  },

  async getMyRsvps(user) {
    await delay();
    if (!user) {
      throw { status: 401, error: { code: 'UNAUTHORIZED', message: 'Sign in required.' } };
    }
    const userRsvps = mockRsvps.filter(r => r.attendeeId === user.userId);
    const enriched = userRsvps.map(r => {
      const event = mockEvents.find(e => e.eventId === r.eventId);
      return {
        ...r,
        event: event || { title: 'Unknown Event', venue: 'Campus', startAt: new Date().toISOString() },
      };
    });
    return { rsvps: enriched };
  },

  // Tickets
  async getTicketById(ticketId, user) {
    await delay();
    const ticket = mockTickets.find(t => t.ticketId === ticketId);
    if (!ticket) {
      throw { status: 404, error: { code: 'TICKET_NOT_FOUND', message: 'Ticket not found.' } };
    }
    // Attendees can only view their own tickets. Coordinators/Organizers assigned can also view.
    if (user && user.role === 'ATTENDEE' && ticket.attendeeId !== user.userId) {
      throw { status: 403, error: { code: 'FORBIDDEN', message: 'Attendees can only view their own digital tickets.' } };
    }
    return { ticket };
  },

  // Check-In and Attendees (Coordinator / Organizer verification)
  async getAttendees(eventId, query = '', user) {
    await delay();
    // Verify user authorization: must be event owner or assigned coordinator
    const event = mockEvents.find(e => e.eventId === eventId);
    if (!event) {
      throw { status: 404, error: { code: 'EVENT_NOT_FOUND', message: 'Event not found.' } };
    }
    const isOwner = event.organizerId === user?.userId;
    const isAssignedCoord = mockEventStaff.some(s => s.eventId === eventId && s.userId === user?.userId);

    if (user && !isOwner && !isAssignedCoord) {
      throw { status: 403, error: { code: 'FORBIDDEN', message: 'You are not assigned as a coordinator or owner for this event.' } };
    }

    const qLower = query.toLowerCase().trim();
    const tickets = mockTickets.filter(t => t.eventId === eventId);
    const results = tickets
      .filter(t => {
        if (!qLower) return true;
        return (
          t.attendeeName.toLowerCase().includes(qLower) ||
          t.attendeeEmail.toLowerCase().includes(qLower) ||
          t.ticketId.toLowerCase().includes(qLower)
        );
      })
      .map(t => ({
        ticketId: t.ticketId,
        attendeeName: t.attendeeName,
        attendeeEmail: t.attendeeEmail,
        status: t.status,
        checkedInAt: t.checkedInAt,
      }));
    return { attendees: results };
  },

  async checkInTicket(eventId, ticketId, user) {
    await delay();
    const event = mockEvents.find(e => e.eventId === eventId);
    if (!event) {
      throw { status: 404, error: { code: 'EVENT_NOT_FOUND', message: 'Event not found.' } };
    }

    // Role & assignment check: Attendee is strictly rejected
    if (user?.role === 'ATTENDEE') {
      throw { status: 403, error: { code: 'FORBIDDEN', message: 'Attendees are strictly prohibited from checking in tickets.' } };
    }

    const isOwner = event.organizerId === user?.userId;
    const isAssignedCoord = mockEventStaff.some(s => s.eventId === eventId && s.userId === user?.userId);

    if (user && !isOwner && !isAssignedCoord) {
      throw { status: 403, error: { code: 'FORBIDDEN', message: 'Access denied: You are not assigned to check in attendees for this event.' } };
    }

    const ticket = mockTickets.find(t => t.ticketId === ticketId);
    if (!ticket) {
      throw { status: 404, error: { code: 'TICKET_NOT_FOUND', message: 'Invalid ticket reference.' } };
    }
    if (ticket.eventId !== eventId) {
      throw { status: 400, error: { code: 'INVALID_EVENT', message: 'Ticket does not belong to this event.' } };
    }
    if (ticket.status === 'CHECKED_IN') {
      throw { 
        status: 409, 
        error: { 
          code: 'ALREADY_CHECKED_IN', 
          message: `Ticket already checked in at ${new Date(ticket.checkedInAt).toLocaleTimeString()} by ${ticket.checkedInBy || 'Coordinator'}.` 
        } 
      };
    }
    if (ticket.status !== 'ACTIVE') {
      throw { status: 400, error: { code: 'TICKET_INACTIVE', message: `Cannot check in ticket with status '${ticket.status}'.` } };
    }

    // Mark checked in
    ticket.status = 'CHECKED_IN';
    ticket.checkedInAt = new Date().toISOString();
    ticket.checkedInBy = user?.name || user?.userId || 'coord-staff';

    return {
      status: 'CHECKED_IN',
      ticketId: ticket.ticketId,
      attendeeName: ticket.attendeeName,
      attendeeEmail: ticket.attendeeEmail,
      checkedInAt: ticket.checkedInAt,
      checkedInBy: ticket.checkedInBy,
    };
  },

  async getEventStats(eventId, user) {
    await delay();
    const event = mockEvents.find(e => e.eventId === eventId);
    if (!event) {
      throw { status: 404, error: { code: 'EVENT_NOT_FOUND', message: 'Event not found.' } };
    }
    // Only event owner or assigned coordinator can view private stats
    const isOwner = event.organizerId === user?.userId;
    const isAssignedCoord = mockEventStaff.some(s => s.eventId === eventId && s.userId === user?.userId);
    if (user && !isOwner && !isAssignedCoord) {
      throw { status: 403, error: { code: 'FORBIDDEN', message: 'Access denied to event statistics.' } };
    }

    const tickets = mockTickets.filter(t => t.eventId === eventId);
    const checkedInCount = tickets.filter(t => t.status === 'CHECKED_IN').length;
    const waitlistCount = mockWaitlist.filter(w => w.eventId === eventId && w.status === 'WAITING').length;
    const confirmedCount = event.confirmedCount;
    const attendancePercentage = confirmedCount > 0 ? Math.round((checkedInCount / confirmedCount) * 100) : 0;

    return {
      capacity: event.capacity,
      confirmedCount,
      waitlistCount,
      checkedInCount,
      attendancePercentage,
    };
  }
};
