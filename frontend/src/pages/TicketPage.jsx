import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { 
  ArrowLeft, 
  Calendar, 
  MapPin, 
  User, 
  Mail, 
  Printer, 
  ShieldCheck, 
  Clock 
} from 'lucide-react';
import * as ticketService from '../services/ticketService';
import StatusBadge from '../components/StatusBadge';
import LoadingSpinner from '../components/LoadingSpinner';
import ErrorMessage from '../components/ErrorMessage';

export default function TicketPage() {
  const { ticketId } = useParams();
  const [ticket, setTicket] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchTicket = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await ticketService.getTicketById(ticketId);
      setTicket(res.ticket);
    } catch (err) {
      console.error('Failed to load ticket:', err);
      setError(err.message || 'Unable to retrieve ticket details. The ticket reference may be invalid or expired.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTicket();
  }, [ticketId]);

  if (loading) {
    return <LoadingSpinner message="Validating ticket reference..." />;
  }

  if (error || !ticket) {
    return (
      <div style={{ maxWidth: '440px', margin: '2rem auto' }}>
        <Link to="/my-registrations" className="btn btn-sm btn-secondary" style={{ marginBottom: '1.25rem', display: 'inline-flex' }}>
          <ArrowLeft size={15} /> Back to My RSVPs
        </Link>
        <ErrorMessage
          title="Ticket Not Found"
          message={error || 'No matching active ticket was found for this reference.'}
          onRetry={fetchTicket}
        />
      </div>
    );
  }

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
    <div style={{ maxWidth: '440px', margin: '1rem auto 3rem' }}>
      <Link to="/my-registrations" className="btn btn-sm btn-secondary" style={{ marginBottom: '1.25rem', display: 'inline-flex' }}>
        <ArrowLeft size={15} /> Back to My RSVPs
      </Link>

      <div className="ticket-card">
        {/* Pass Header */}
        <div className="ticket-header">
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', marginBottom: '0.2rem' }}>
              <span className="brand-emblem" style={{ width: '20px', height: '20px', fontSize: '0.75rem' }}>M</span>
              <span style={{ fontSize: '0.6875rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--accent-pink)', fontWeight: 700 }}>
                Marque Campus Pass
              </span>
            </div>
            <h2 style={{ fontSize: '1.2rem', color: '#fff', lineHeight: 1.3 }}>
              {ticket.eventTitle || 'Campus Event'}
            </h2>
          </div>
          <StatusBadge status={ticket.status} />
        </div>

        {/* Pass Body */}
        <div className="ticket-body">
          {/* QR Code strictly contains the opaque ticket ID */}
          <div className="qr-wrapper">
            <QRCodeSVG
              value={ticket.ticketId}
              size={180}
              level="H"
              includeMargin={false}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.2rem' }}>
            <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>
              Opaque Ticket ID
            </span>
            <span className="ticket-code-display">
              {ticket.ticketId}
            </span>
          </div>

          <div style={{ width: '100%', textAlign: 'left', background: '#1B1D24', padding: '1rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-default)', display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.8125rem' }}>
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
            {ticket.checkedInAt && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--status-info)', fontSize: '0.75rem', borderTop: '1px solid var(--border-subtle)', paddingTop: '0.45rem' }}>
                <Clock size={13} />
                <span>Checked In: {new Date(ticket.checkedInAt).toLocaleString()}</span>
              </div>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            <ShieldCheck size={14} style={{ color: 'var(--status-success)', flexShrink: 0 }} />
            <span>Present this QR code at the door for entry. Single-use ticket.</span>
          </div>

          <button onClick={() => window.print()} className="btn btn-secondary btn-sm" style={{ width: '100%' }}>
            <Printer size={14} />
            <span>Print / Save Pass</span>
          </button>
        </div>
      </div>
    </div>
  );
}
