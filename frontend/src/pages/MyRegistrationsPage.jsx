import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  Ticket, 
  Calendar, 
  MapPin, 
  Clock, 
  CheckCircle, 
  XCircle, 
  AlertCircle, 
  QrCode, 
  ArrowRight 
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
      setError(err.message || 'Unable to retrieve your event registrations.');
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
    if (!window.confirm('Are you sure you want to cancel this registration?')) return;
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
        title="Sign in to view your registrations"
        description="Access your confirmed passes, manage your waitlist position, and present your QR code at check-in."
        actionLabel="Sign In"
        onAction={() => window.location.href = '/auth'}
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
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', marginBottom: '2rem' }}>
        <div>
          <h1 style={{ fontSize: '2rem', marginBottom: '0.25rem' }}>My Registrations</h1>
          <p style={{ color: 'var(--text-secondary)' }}>
            Manage your campus event passes, tickets, and waitlist queues.
          </p>
        </div>

        {/* Filter Tabs */}
        <div style={{ display: 'flex', gap: '0.5rem', background: 'rgba(255, 255, 255, 0.05)', padding: '0.25rem', borderRadius: 'var(--radius-full)', border: '1px solid var(--border-subtle)' }}>
          {['ALL', 'CONFIRMED', 'WAITLISTED', 'CANCELLED'].map((tab) => (
            <button
              key={tab}
              onClick={() => setStatusFilter(tab)}
              className={`btn btn-sm ${statusFilter === tab ? 'btn-primary' : ''}`}
              style={{ borderRadius: 'var(--radius-full)', fontSize: '0.75rem', padding: '0.35rem 0.75rem' }}
            >
              {tab === 'ALL' ? 'All' : tab.charAt(0) + tab.slice(1).toLowerCase()}
            </button>
          ))}
        </div>
      </div>

      {/* Feedback banner */}
      {feedback && (
        <div
          style={{
            marginBottom: '1.5rem',
            padding: '1rem',
            borderRadius: 'var(--radius-md)',
            background: feedback.type === 'success' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
            border: `1px solid ${feedback.type === 'success' ? 'rgba(16, 185, 129, 0.4)' : 'rgba(239, 68, 68, 0.4)'}`,
            color: feedback.type === 'success' ? '#34d399' : '#f87171',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
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
          title="No registrations found"
          description={statusFilter === 'ALL' ? "You haven't registered for any events yet. Check out the event catalog!" : `No registrations with status '${statusFilter}'.`}
          actionLabel="Browse Events"
          onAction={() => window.location.href = '/events'}
        />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1.5rem' }}>
          {filteredRsvps.map((rsvp) => {
            const formattedDate = rsvp.event?.startAt
              ? new Date(rsvp.event.startAt).toLocaleString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })
              : 'TBA';

            return (
              <div key={rsvp.rsvpId} className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.75rem' }}>
                  <h3 style={{ fontSize: '1.125rem', lineHeight: 1.35 }}>
                    <Link to={`/events/${rsvp.eventId}`} style={{ color: 'var(--text-primary)' }}>
                      {rsvp.event?.title || 'Campus Event'}
                    </Link>
                  </h3>
                  <StatusBadge status={rsvp.status} />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Calendar size={14} style={{ color: 'var(--accent-primary)' }} />
                    <span>{formattedDate}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <MapPin size={14} style={{ color: 'var(--accent-secondary)' }} />
                    <span>{rsvp.event?.venue || 'Campus Venue'}</span>
                  </div>

                  {rsvp.status === 'WAITLISTED' && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#fbbf24', fontWeight: 600, marginTop: '0.25rem' }}>
                      <Clock size={14} />
                      <span>Queue Position: #{rsvp.queuePosition || 1}</span>
                    </div>
                  )}

                  {rsvp.ticketId && (
                    <div style={{ fontSize: '0.75rem', fontFamily: 'monospace', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                      Ticket Ref: {rsvp.ticketId}
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div style={{ marginTop: 'auto', paddingTop: '0.75rem', borderTop: '1px solid var(--border-subtle)', display: 'flex', gap: '0.5rem' }}>
                  {rsvp.status === 'CONFIRMED' && rsvp.ticketId && (
                    <button
                      onClick={() => openTicket(rsvp)}
                      className="btn btn-sm btn-primary"
                      style={{ flex: 1 }}
                    >
                      <QrCode size={14} />
                      View QR Ticket
                    </button>
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
