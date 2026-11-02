export interface EventStaffRecord {
  eventId: string;
  userId: string;
  email: string;
  name: string;
  permission: 'CHECK_IN';
  assignedAt: string;
  assignedBy: string;
}

export interface AssignedEventSummary {
  eventId: string;
  title: string;
  venue: string;
  startAt: string;
  confirmedCount: number;
}
