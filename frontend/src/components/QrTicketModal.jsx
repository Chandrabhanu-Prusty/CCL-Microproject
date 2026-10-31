import React from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { X, Calendar, MapPin, User, Mail, Printer, ShieldCheck } from 'lucide-react';
import StatusBadge from './StatusBadge';

export default function QrTicketModal({ ticket, onClose }) {
  if (!ticket) return null;

  const handlePrint = () => {
    window.print();
  };

  const formattedDate = ticket.eventStartAt
    ? new Date(ticket.eventStartAt).toLocaleString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : 'TBA';

  return (
    <div className="modal-overlay" onClick={onClose} role="dialog" aria-modal="true" aria-labelledby="ticket-modal-title">
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '440px', padding: 0, overflow: 'hidden' }}>
        {/* Modal Close Button */}
        <button
          onClick={onClose}
          aria-label="Close ticket modal"
          style={{
            position: 'absolute',
            top: '0.85rem',
            right: '0.85rem',
            zIndex: 10,
            background: '#14151B',
            color: 'var(--text-secondary)',
            borderRadius: 'var(--radius-xs)',
            width: '28px',
            height: '28px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: '1px solid var(--border-default)',
          }}
        >
          <X size={16} />
        </button>

        {/* Digital Ticket Pass */}
        <div className="ticket-card" style={{ border: 'none' }}>
          <div className="ticket-header">
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.2rem' }}>
                <span className="brand-emblem" style={{ width: '20px', height: '20px', fontSize: '0.75rem' }}>M</span>
                <span style={{ fontSize: '0.6875rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--accent-pink)', fontWeight: 700 }}>
                  Marque Campus Pass
                </span>
              </div>
              <h3 id="ticket-modal-title" style={{ fontSize: '1.15rem', color: '#fff', lineHeight: 1.3 }}>
                {ticket.eventTitle || 'Campus Event'}
              </h3>
            </div>
            <StatusBadge status={ticket.status} />
          </div>

          <div className="ticket-body">
            {/* The QR contains ONLY the opaque ticket ID as mandated by API_CONTRACT */}
            <div className="qr-wrapper">
              <QRCodeSVG
                value={ticket.ticketId}
                size={170}
                level="H"
                includeMargin={false}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.2rem' }}>
              <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>
                Opaque Ticket Reference
              </span>
              <span className="ticket-code-display">
                {ticket.ticketId}
              </span>
            </div>

            {/* Event Details Summary */}
            <div style={{ width: '100%', textAlign: 'left', background: '#1B1D24', padding: '0.9rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-default)', display: 'flex', flexDirection: 'column', gap: '0.45rem', fontSize: '0.8125rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-secondary)' }}>
                <Calendar size={14} style={{ color: 'var(--accent-pink)', flexShrink: 0 }} />
                <span>{formattedDate}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-secondary)' }}>
                <MapPin size={14} style={{ color: 'var(--accent-orange)', flexShrink: 0 }} />
                <span>{ticket.eventVenue || 'Campus Venue'}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-secondary)' }}>
                <User size={14} style={{ color: 'var(--status-success)', flexShrink: 0 }} />
                <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{ticket.attendeeName || 'Attendee'}</span>
              </div>
              {ticket.attendeeEmail && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-secondary)' }}>
                  <Mail size={14} style={{ color: 'var(--status-info)', flexShrink: 0 }} />
                  <span>{ticket.attendeeEmail}</span>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              <ShieldCheck size={14} style={{ color: 'var(--status-success)', flexShrink: 0 }} />
              <span>Please present this QR code to the coordinator at venue check-in. Single-use entry only.</span>
            </div>

            <div style={{ display: 'flex', gap: '0.65rem', width: '100%', marginTop: '0.5rem' }}>
              <button onClick={handlePrint} className="btn btn-secondary btn-sm" style={{ flex: 1 }}>
                <Printer size={14} />
                <span>Print / Save Pass</span>
              </button>
              <button onClick={onClose} className="btn btn-primary btn-sm" style={{ flex: 1 }}>
                Done
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
