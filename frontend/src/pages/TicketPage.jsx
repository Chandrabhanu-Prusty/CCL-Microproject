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
  Clock, 
  Sparkles 
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
      <div style={{ maxWidth: '480px', margin: '2rem auto' }}>
        <Link to="/events" className="btn btn-sm btn-secondary" style={{ marginBottom: '1.5rem', display: 'inline-flex' }}>
          <ArrowLeft size={16} /> Browse Events
        </Link>
        <ErrorMessage
          title="Ticket Not Found"
          message={error || 'No matching active ticket was found for this ID.'}
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
    <div style={{ maxWidth: '500px', margin: '1rem auto 3.5rem' }}>
      <Link to="/my-registrations" className="btn btn-sm btn-secondary" style={{ marginBottom: '1.5rem', display: 'inline-flex' }}>
        <ArrowLeft size={16} /> Back to My Registrations
      </Link>

      <div className="ticket-card" style={{ boxShadow: 'var(--shadow-lg), var(--accent-subtle-glow)' }}>
        {/* Ticket Header */}
        <div className="ticket-header" style={{ background: 'rgba(255, 61, 141, 0.1)', borderBottom: '1px solid var(--border-subtle)' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--accent-secondary)', fontWeight: 800 }}>
              <Sparkles size={13} />
              <span>Official Campus Pass</span>
            </div>
            <h2 style={{ fontSize: '1.35rem', marginTop: '0.25rem', color: '#ffffff' }}>
              {ticket.eventTitle || 'Campus Event'}
            </h2>
          </div>
          <StatusBadge status={ticket.status} />
        </div>

        {/* Ticket Body */}
        <div className="ticket-body">
          {/* QR Code contains strictly ONLY the opaque ticket ID */}
          <div className="qr-wrapper" style={{ padding: '1.15rem' }}>
            <QRCodeSVG
              value={ticket.ticketId}
              size={210}
              level="H"
              includeMargin={false}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.3rem' }}>
            <span style={{ fontSize: '0.725rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>
              Opaque Ticket Reference
            </span>
            <span className="ticket-code-display">
              {ticket.ticketId}
            </span>
          </div>

          <div
            style={{
              width: '100%',
              textAlign: 'left',
              background: '#14141b',
              padding: '1.25rem',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-subtle)',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.75rem',
              fontSize: '0.875rem',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', color: 'var(--text-secondary)' }}>
              <Calendar size={16} style={{ color: 'var(--accent-primary)', flexShrink: 0 }} />
              <span>{formattedDate}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', color: 'var(--text-secondary)' }}>
              <MapPin size={16} style={{ color: 'var(--accent-secondary)', flexShrink: 0 }} />
              <span>{ticket.eventVenue || 'Campus Venue'}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', color: 'var(--text-secondary)' }}>
              <User size={16} style={{ color: '#34d399', flexShrink: 0 }} />
              <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{ticket.attendeeName || 'Attendee'}</span>
            </div>
            {ticket.attendeeEmail && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', color: 'var(--text-secondary)' }}>
                <Mail size={16} style={{ color: '#60a5fa', flexShrink: 0 }} />
                <span>{ticket.attendeeEmail}</span>
              </div>
            )}
            {ticket.checkedInAt && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', color: '#60a5fa', fontSize: '0.8125rem', borderTop: '1px solid var(--border-subtle)', paddingTop: '0.5rem' }}>
                <Clock size={15} />
                <span>Checked In: {new Date(ticket.checkedInAt).toLocaleString()}</span>
              </div>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            <ShieldCheck size={14} style={{ color: 'var(--accent-primary)' }} />
            Single-use verified pass. Scan at entrance to validate admission.
          </div>

          <button onClick={() => window.print()} className="btn btn-secondary" style={{ width: '100%', height: '42px' }}>
            <Printer size={16} />
            <span>Print / Save Physical Copy</span>
          </button>
        </div>
      </div>
    </div>
  );
}
