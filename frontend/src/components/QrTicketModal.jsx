import React from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { X, Calendar, MapPin, User, Mail, Printer, ShieldCheck, Sparkles } from 'lucide-react';
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
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '480px', padding: 0, overflow: 'hidden' }}>
        {/* Modal Close Button */}
        <button
          onClick={onClose}
          aria-label="Close ticket modal"
          style={{
            position: 'absolute',
            top: '1rem',
            right: '1rem',
            zIndex: 10,
            background: 'rgba(0, 0, 0, 0.55)',
            color: '#fff',
            borderRadius: '50%',
            width: '32px',
            height: '32px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: '1px solid rgba(255, 255, 255, 0.1)',
          }}
        >
          <X size={18} />
        </button>

        {/* Ticket Aesthetics */}
        <div className="ticket-card" style={{ border: 'none', borderRadius: 'var(--radius-xl)' }}>
          <div className="ticket-header" style={{ background: 'rgba(255, 61, 141, 0.12)' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.725rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--accent-secondary)', fontWeight: 800 }}>
                <Sparkles size={12} />
                <span>Official Campus Pass</span>
              </div>
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
                size={185}
                level="H"
                includeMargin={false}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.25rem' }}>
              <span style={{ fontSize: '0.725rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>
                Opaque Ticket Reference
              </span>
              <span className="ticket-code-display">
                {ticket.ticketId}
              </span>
            </div>

            <div style={{ width: '100%', textAlign: 'left', background: '#14141b', padding: '1rem 1.15rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column', gap: '0.55rem', fontSize: '0.85rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-secondary)' }}>
                <Calendar size={15} style={{ color: 'var(--accent-primary)', flexShrink: 0 }} />
                <span>{formattedDate}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-secondary)' }}>
                <MapPin size={15} style={{ color: 'var(--accent-secondary)', flexShrink: 0 }} />
                <span>{ticket.eventVenue || 'Campus Venue'}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-secondary)' }}>
                <User size={15} style={{ color: '#34d399', flexShrink: 0 }} />
                <span>{ticket.attendeeName || 'Attendee'}</span>
              </div>
              {ticket.attendeeEmail && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-secondary)' }}>
                  <Mail size={15} style={{ color: '#60a5fa', flexShrink: 0 }} />
                  <span>{ticket.attendeeEmail}</span>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              <ShieldCheck size={14} style={{ color: 'var(--accent-primary)' }} />
              Single-use verified ticket. Present this code at venue check-in.
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', width: '100%' }}>
              <button onClick={handlePrint} className="btn btn-secondary" style={{ flex: 1 }}>
                <Printer size={16} />
                <span>Print</span>
              </button>
              <button onClick={onClose} className="btn btn-primary" style={{ flex: 1 }}>
                <span>Done</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
