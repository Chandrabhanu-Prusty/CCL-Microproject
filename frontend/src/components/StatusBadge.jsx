import React from 'react';
import { CheckCircle2, Clock, XCircle, QrCode } from 'lucide-react';

export default function StatusBadge({ status, className = '' }) {
  if (!status) return null;

  const normalized = status.toUpperCase();

  switch (normalized) {
    case 'CONFIRMED':
    case 'ACTIVE':
      return (
        <span className={`status-badge badge-confirmed ${className}`}>
          <CheckCircle2 size={13} />
          {normalized === 'ACTIVE' ? 'Active Ticket' : 'Confirmed'}
        </span>
      );
    case 'WAITLISTED':
    case 'WAITING':
      return (
        <span className={`status-badge badge-waitlisted ${className}`}>
          <Clock size={13} />
          Waitlisted
        </span>
      );
    case 'CHECKED_IN':
      return (
        <span className={`status-badge badge-checked_in ${className}`}>
          <QrCode size={13} />
          Checked In
        </span>
      );
    case 'CANCELLED':
      return (
        <span className={`status-badge badge-cancelled ${className}`}>
          <XCircle size={13} />
          Cancelled
        </span>
      );
    default:
      return (
        <span className={`status-badge ${className}`}>
          {status}
        </span>
      );
  }
}
