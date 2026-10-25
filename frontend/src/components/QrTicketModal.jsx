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
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '480px', padding: 0 }}>
        {/* Modal Close Button */}
        <button
          onClick={onClose}
          aria-label="Close ticket modal"
          style={{
            position: 'absolute',
            top: '1rem',
            right: '1rem',
            zIndex: 10,
            background: 'rgba(0, 0, 0, 0.4)',
            color: '#fff',
            borderRadius: '50%',
            width: '32px',
            height: '32px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <X size={18} />
        </button>

        {/* Ticket Aesthetics */}
        <div className="ticket-card" style={{ border: 'none', borderRadius: 'var(--radius-xl)' }}>
          <div className="ticket-header">
            <div>
              <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: '#a5b4fc', fontWeight: 700 }}>
                Official Campus Pass
              </span>
              <h3 id="ticket-modal-title" style={{ fontSize: '1.25rem', marginTop: '0.2rem', color: '#fff' }}>
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
                size={180}
                level="H"
                includeMargin={false}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.25rem' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Opaque Ticket Reference
              </span>
              <span className="ticket-code-display">
                {ticket.ticketId}
              </span>
            </div>

            <div style={{ width: '100%', textAlign: 'left', background: 'rgba(15, 23, 42, 0.6)', padding: '1rem', borderRadius: 'var(--radius-md)', display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.875rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-secondary)' }}>
                <Calendar size={15} style={{ color: '#818cf8' }} />
                <span>{formattedDate}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-secondary)' }}>
                <MapPin size={15} style={{ color: '#ec4899' }} />
                <span>{ticket.eventVenue || 'Campus Venue'}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-secondary)' }}>
                <User size={15} style={{ color: '#34d399' }} />
                <span>{ticket.attendeeName || 'Attendee'}</span>
              </div>
              {ticket.attendeeEmail && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-secondary)' }}>
                  <Mail size={15} style={{ color: '#60a5fa' }} />
                  <span>{ticket.attendeeEmail}</span>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.75rem', color: '#94a3b8' }}>
              <ShieldCheck size={14} style={{ color: '#10b981' }} />
              Single-use verified ticket. Present this code at venue check-in.
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', width: '100%' }}>
              <button onClick={handlePrint} className="btn btn-secondary" style={{ flex: 1 }}>
                <Printer size={16} />
                Print / Save
              </button>
              <button onClick={onClose} className="btn btn-primary" style={{ flex: 1 }}>
                Done
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
