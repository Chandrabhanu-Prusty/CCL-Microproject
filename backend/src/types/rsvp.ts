import type { EventItem } from './event.js';

export type RsvpStatus = 'CONFIRMED' | 'WAITLISTED' | 'CANCELLED';

export interface RsvpItem {
  eventId: string;
  attendeeId: string;
  rsvpId: string;
  status: RsvpStatus;
  ticketId?: string;
  queueKey?: string;
  createdAt: string;
  updatedAt: string;
}

export interface WaitlistItem {
  eventId: string;
  queueKey: string;
  attendeeId: string;
  attendeeName?: string;
  attendeeEmail: string;
  status: 'WAITING';
  createdAt: string;
}

export interface TicketItem {
  ticketId: string;
  eventId: string;
  attendeeId: string;
  attendeeName: string;
  attendeeEmail: string;
  eventTitle: string;
  eventVenue: string;
  eventStartAt: string;
  status: 'ACTIVE' | 'CHECKED_IN' | 'CANCELLED';
  issuedAt: string;
  checkedInAt?: string | null;
  checkedInBy?: string | null;
  updatedAt?: string;
}

export interface ConfirmedRsvpResult {
  status: 'CONFIRMED';
  rsvpId: string;
  ticketId: string;
  message: string;
}

export interface WaitlistedRsvpResult {
  status: 'WAITLISTED';
  rsvpId: string;
  queuePosition: number;
  queueKey: string;
  message: string;
}

export type RsvpResult = ConfirmedRsvpResult | WaitlistedRsvpResult;

export interface CancelRsvpResult {
  message: string;
  promotedAttendee?: string | null;
}

export interface UserRsvpSummary {
  rsvpId: string;
  eventId: string;
  status: RsvpStatus;
  ticketId?: string;
  queueKey?: string | null;
  createdAt: string;
  event: {
    title: string;
    venue: string;
    startAt: string;
  };
}
