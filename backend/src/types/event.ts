export type EventCategory = 'Technology' | 'Workshop' | 'Cultural' | 'Academic' | 'Sports';
export type EventStatus = 'PUBLISHED' | 'DRAFT' | 'CANCELLED';

export interface EventItem {
  eventId: string;
  title: string;
  description: string;
  category: EventCategory;
  startAt: string;
  endAt?: string;
  venue: string;
  capacity: number;
  confirmedCount: number;
  waitlistCount?: number;
  status: EventStatus;
  organizerId: string;
  bannerUrl?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateEventInput {
  title: string;
  description: string;
  category: EventCategory;
  startAt: string;
  endAt?: string;
  venue: string;
  capacity: number;
  bannerUrl?: string;
}

export interface UpdateEventInput {
  title?: string;
  description?: string;
  category?: EventCategory;
  startAt?: string;
  endAt?: string;
  venue?: string;
  capacity?: number;
  bannerUrl?: string;
}

export interface EventFilters {
  q?: string;
  category?: string;
}
