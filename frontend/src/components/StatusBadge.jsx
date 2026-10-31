import React from 'react';
import { CheckCircle2, Clock, XCircle, QrCode, Sparkles } from 'lucide-react';

export default function StatusBadge({ status, className = '' }) {
  if (!status) return null;

  const normalized = status.toUpperCase();

  switch (normalized) {
    case 'CONFIRMED':
    case 'ACTIVE':
      return (
        <span className={`status-badge badge-confirmed ${className}`}>
          <CheckCircle2 size={12} />
          {normalized === 'ACTIVE' ? 'Active' : 'Confirmed'}
        </span>
      );
    case 'WAITLISTED':
    case 'WAITING':
      return (
        <span className={`status-badge badge-waitlisted ${className}`}>
          <Clock size={12} />
          Waitlisted
        </span>
      );
    case 'CHECKED_IN':
      return (
        <span className={`status-badge badge-checked_in ${className}`}>
          <QrCode size={12} />
          Checked In
        </span>
      );
    case 'CANCELLED':
      return (
        <span className={`status-badge badge-cancelled ${className}`}>
          <XCircle size={12} />
          Cancelled
        </span>
      );
    case 'PUBLISHED':
      return (
        <span className={`status-badge badge-published ${className}`}>
          <Sparkles size={12} />
          Published
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
