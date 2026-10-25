import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  Ticket, 
  Calendar, 
  MapPin, 
  Clock, 
  CheckCircle, 
  XCircle, 
  AlertCircle, 
  QrCode, 
  ArrowRight,
  Sparkles,
  ExternalLink
} from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import * as rsvpService from '../services/rsvpService';
import StatusBadge from '../components/StatusBadge';
import QrTicketModal from '../components/QrTicketModal';
import LoadingSpinner from '../components/LoadingSpinner';
import EmptyState from '../components/EmptyState';
import ErrorMessage from '../components/ErrorMessage';

export default function MyRegistrationsPage() {
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [rsvps, setRsvps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [activeTicket, setActiveTicket] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [feedback, setFeedback] = useState(null);

  const loadRsvps = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await rsvpService.getMyRsvps();
      setRsvps(res.rsvps || []);
    } catch (err) {
      console.error('Failed to load registrations:', err);
      setError(err.message || 'Unable to retrieve your campus event registrations.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      loadRsvps();
    } else {
      setLoading(false);
    }
  }, [isAuthenticated]);

  const handleCancel = async (eventId) => {
    if (!window.confirm('Are you sure you want to cancel this registration? Your ticket will be released to the waitlist.')) return;
    try {
      setActionLoading(true);
      setFeedback(null);
      const res = await rsvpService.cancelRsvp(eventId);
      setFeedback({
        type: 'success',
        message: res.message || 'Registration successfully cancelled.',
      });
      await loadRsvps();
    } catch (err) {
      console.error('Cancellation error:', err);
      setFeedback({
        type: 'error',
        message: err.message || 'Failed to cancel registration.',
      });
    } finally {
      setActionLoading(false);
    }
  };

  const openTicket = (rsvp) => {
    const ticket = {
      ticketId: rsvp.ticketId,
      eventId: rsvp.eventId,
      eventTitle: rsvp.event?.title || 'Campus Event',
      eventVenue: rsvp.event?.venue || 'Campus Venue',
      eventStartAt: rsvp.event?.startAt || rsvp.createdAt,
      attendeeName: user?.name || 'Campus Attendee',
      attendeeEmail: user?.email || '',
      status: rsvp.status === 'CONFIRMED' ? 'ACTIVE' : rsvp.status,
    };
    setActiveTicket(ticket);
  };

  if (!isAuthenticated) {
    return (
      <EmptyState
        icon={Ticket}
        title="Sign in to view your campus passes"
        description="Access your confirmed digital QR tickets, monitor your waitlist position, and manage reservations."
        actionLabel="Sign In"
        onAction={() => navigate('/auth', { state: { from: '/my-registrations' } })}
      />
    );
  }

  const filteredRsvps = rsvps.filter((r) => {
    if (statusFilter === 'CONFIRMED') return r.status === 'CONFIRMED';
    if (statusFilter === 'WAITLISTED') return r.status === 'WAITLISTED';
    if (statusFilter === 'CANCELLED') return r.status === 'CANCELLED';
    return true;
  });

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '1.25rem', marginBottom: '2rem' }}>
        <div>
          <h1 style={{ fontSize: '2.15rem', marginBottom: '0.35rem' }}>My Registrations</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
            Manage your official campus passes, queue positions, and single-use digital tickets.
          </p>
        </div>

        {/* Filter Tabs */}
        <div style={{ display: 'flex', gap: '0.35rem', background: '#191921', padding: '0.3rem', borderRadius: 'var(--radius-full)', border: '1px solid var(--border-subtle)' }}>
          {['ALL', 'CONFIRMED', 'WAITLISTED', 'CANCELLED'].map((tab) => (
            <button
              key={tab}
              onClick={() => setStatusFilter(tab)}
              className={`btn btn-sm ${statusFilter === tab ? 'btn-primary' : 'btn-secondary'}`}
              style={{
                borderRadius: 'var(--radius-full)',
                fontSize: '0.78rem',
                padding: '0.35rem 0.85rem',
                border: statusFilter === tab ? 'none' : 'transparent',
              }}
            >
              {tab === 'ALL' ? 'All Passes' : tab.charAt(0) + tab.slice(1).toLowerCase()}
            </button>
          ))}
        </div>
      </div>

      {/* Feedback banner */}
      {feedback && (
        <div
          style={{
            marginBottom: '1.75rem',
            padding: '1rem 1.25rem',
            borderRadius: 'var(--radius-md)',
            background: feedback.type === 'success' ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)',
            border: `1px solid ${feedback.type === 'success' ? 'rgba(16, 185, 129, 0.35)' : 'rgba(239, 68, 68, 0.35)'}`,
            color: feedback.type === 'success' ? '#34d399' : '#f87171',
            display: 'flex',
            alignItems: 'center',
            gap: '0.65rem',
            fontSize: '0.925rem',
          }}
        >
          {feedback.type === 'success' ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
          <span>{feedback.message}</span>
        </div>
      )}

      {/* Content */}
      {loading ? (
        <LoadingSpinner message="Loading your passes..." />
      ) : error ? (
        <ErrorMessage title="Error fetching registrations" message={error} onRetry={loadRsvps} />
      ) : filteredRsvps.length === 0 ? (
        <EmptyState
          icon={Ticket}
          title="No passes match this filter"
          description={
            statusFilter === 'ALL'
              ? "You haven't reserved any passes yet. Explore upcoming campus events to get started!"
              : `No registrations found with status '${statusFilter}'.`
          }
          actionLabel="Browse Campus Events"
          onAction={() => navigate('/events')}
        />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(330px, 1fr))', gap: '1.75rem' }}>
          {filteredRsvps.map((rsvp) => {
            const formattedDate = rsvp.event?.startAt
              ? new Date(rsvp.event.startAt).toLocaleString('en-US', {
                  weekday: 'short',
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })
              : 'TBA';

            return (
              <div key={rsvp.rsvpId} className="card card-hoverable" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', background: '#191921', borderColor: 'var(--border-subtle)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.75rem' }}>
                  <h3 style={{ fontSize: '1.18rem', lineHeight: 1.35 }}>
                    <Link to={`/events/${rsvp.eventId}`} style={{ color: 'var(--text-primary)' }}>
                      {rsvp.event?.title || 'Campus Event'}
                    </Link>
                  </h3>
                  <StatusBadge status={rsvp.status} />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.825rem', color: 'var(--text-secondary)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                    <Calendar size={14} style={{ color: 'var(--accent-primary)' }} />
                    <span>{formattedDate}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                    <MapPin size={14} style={{ color: 'var(--accent-secondary)' }} />
                    <span>{rsvp.event?.venue || 'Campus Venue'}</span>
                  </div>

                  {rsvp.status === 'WAITLISTED' && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', color: '#ff9a54', fontWeight: 600, marginTop: '0.35rem', background: 'rgba(255, 138, 61, 0.1)', padding: '0.35rem 0.65rem', borderRadius: 'var(--radius-sm)' }}>
                      <Clock size={14} />
                      <span>Waitlist Queue Position: #{rsvp.queuePosition || 1}</span>
                    </div>
                  )}

                  {rsvp.ticketId && (
                    <div style={{ fontSize: '0.75rem', fontFamily: 'monospace', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                      Ticket ID: <span style={{ color: 'var(--accent-secondary)' }}>{rsvp.ticketId}</span>
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div style={{ marginTop: 'auto', paddingTop: '0.85rem', borderTop: '1px solid var(--border-subtle)', display: 'flex', gap: '0.65rem' }}>
                  {rsvp.status === 'CONFIRMED' && rsvp.ticketId && (
                    <button
                      onClick={() => openTicket(rsvp)}
                      className="btn btn-sm btn-primary"
                      style={{ flex: 1 }}
                    >
                      <QrCode size={14} />
                      <span>Digital Pass</span>
                    </button>
                  )}

                  {rsvp.ticketId && (
                    <Link
                      to={`/tickets/${rsvp.ticketId}`}
                      className="btn btn-sm btn-outline"
                      title="Open Dedicated Ticket Page"
                    >
                      <ExternalLink size={14} />
                    </Link>
                  )}

                  {rsvp.status !== 'CANCELLED' && (
                    <button
                      onClick={() => handleCancel(rsvp.eventId)}
                      disabled={actionLoading}
                      className="btn btn-sm btn-danger"
                    >
                      Cancel
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Ticket Modal */}
      {activeTicket && (
        <QrTicketModal ticket={activeTicket} onClose={() => setActiveTicket(null)} />
      )}
    </div>
  );
}
