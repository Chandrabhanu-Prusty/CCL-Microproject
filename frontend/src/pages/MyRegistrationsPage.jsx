import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  Ticket, 
  Calendar, 
  MapPin, 
  Clock, 
  CheckCircle, 
  X, 
  AlertCircle, 
  QrCode, 
  Eye,
  Trash2
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
    if (!window.confirm('Are you sure you want to cancel this registration? Your reserved seat will be transferred to the waitlist.')) {
      return;
    }
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
        actionLabel="Sign In to Marque"
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

  const defaultBanner = 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?auto=format&fit=crop&w=800&q=80';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Header and Filter Tabs */}
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '1rem' }}>
        <div>
          <h2 style={{ fontSize: '1.5rem', marginBottom: '0.25rem' }}>My RSVPs</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
            Manage your official event registrations, queue positions, and digital entry tickets.
          </p>
        </div>

        {/* Status Tabs */}
        <div style={{ display: 'flex', gap: '0.35rem', background: 'var(--bg-card)', padding: '0.25rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-default)' }}>
          {['ALL', 'CONFIRMED', 'WAITLISTED', 'CANCELLED'].map((tab) => (
            <button
              key={tab}
              onClick={() => setStatusFilter(tab)}
              className={`btn btn-sm ${statusFilter === tab ? 'btn-primary' : 'btn-ghost'}`}
              style={{ fontSize: '0.75rem', padding: '0.3rem 0.65rem' }}
            >
              {tab === 'ALL' ? 'All RSVPs' : tab.charAt(0) + tab.slice(1).toLowerCase()}
            </button>
          ))}
        </div>
      </div>

      {/* Feedback banner */}
      {feedback && (
        <div
          style={{
            padding: '0.75rem 1rem',
            borderRadius: 'var(--radius-sm)',
            background: feedback.type === 'success' ? 'var(--status-success-bg)' : 'var(--status-error-bg)',
            border: `1px solid ${feedback.type === 'success' ? 'var(--status-success-border)' : 'var(--status-error-border)'}`,
            color: feedback.type === 'success' ? 'var(--status-success)' : 'var(--status-error)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '0.5rem',
            fontSize: '0.875rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            {feedback.type === 'success' ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
            <span>{feedback.message}</span>
          </div>
          <button onClick={() => setFeedback(null)} aria-label="Dismiss feedback" style={{ color: 'inherit' }}>
            <X size={15} />
          </button>
        </div>
      )}

      {/* Content List */}
      <section aria-label="Registration Records">
        {loading ? (
          <LoadingSpinner message="Retrieving your campus passes..." />
        ) : error ? (
          <ErrorMessage title="Error fetching registrations" message={error} onRetry={loadRsvps} />
        ) : filteredRsvps.length === 0 ? (
          <EmptyState
            icon={Ticket}
            title="No registrations found"
            description={
              statusFilter === 'ALL'
                ? "You haven't reserved any event tickets yet. Explore upcoming campus events to get started!"
                : `No registrations found with status '${statusFilter}'.`
            }
            actionLabel="Discover Events"
            onAction={() => navigate('/events')}
          />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {filteredRsvps.map((rsvp) => {
              const formattedDate = rsvp.event?.startAt
                ? new Date(rsvp.event.startAt).toLocaleString('en-US', {
                    weekday: 'short',
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })
                : 'TBA';

              return (
                <article key={rsvp.rsvpId} className="event-row">
                  <div className="event-row-left">
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.45rem' }}>
                        <StatusBadge status={rsvp.status} />
                        {rsvp.status === 'WAITLISTED' && (
                          <span style={{ fontSize: '0.75rem', color: 'var(--status-warning)', fontWeight: 600 }}>
                            Queue Position #{rsvp.queuePosition || 1}
                          </span>
                        )}
                        {rsvp.ticketId && (
                          <span style={{ fontSize: '0.75rem', fontFamily: 'monospace', color: 'var(--text-muted)' }}>
                            Ticket ID: {rsvp.ticketId}
                          </span>
                        )}
                      </div>

                      <h3 className="event-row-title">
                        <Link to={`/events/${rsvp.eventId}`}>
                          {rsvp.event?.title || 'Campus Event'}
                        </Link>
                      </h3>
                    </div>

                    <div className="event-meta-list">
                      <div className="event-meta-item">
                        <Calendar size={14} style={{ color: 'var(--accent-pink)' }} />
                        <span>{formattedDate}</span>
                      </div>
                      <div className="event-meta-item">
                        <MapPin size={14} style={{ color: 'var(--accent-orange)' }} />
                        <span>{rsvp.event?.venue || 'Campus Venue'}</span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="event-row-actions">
                      <Link 
                        to={`/events/${rsvp.eventId}`} 
                        className="btn btn-sm btn-secondary"
                      >
                        <Eye size={13} />
                        <span>Event Details</span>
                      </Link>

                      {rsvp.status === 'CONFIRMED' && rsvp.ticketId && (
                        <button
                          onClick={() => openTicket(rsvp)}
                          className="btn btn-sm btn-primary"
                        >
                          <QrCode size={14} />
                          <span>View QR Ticket</span>
                        </button>
                      )}

                      {rsvp.status !== 'CANCELLED' && (
                        <button
                          onClick={() => handleCancel(rsvp.eventId)}
                          disabled={actionLoading}
                          className="btn btn-sm btn-danger"
                          title="Cancel RSVP"
                        >
                          <Trash2 size={13} />
                          <span>Cancel RSVP</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Banner Image */}
                  <div className="event-row-banner">
                    <img 
                      src={rsvp.event?.bannerUrl || defaultBanner} 
                      alt={rsvp.event?.title || 'Event'} 
                      loading="lazy"
                      onError={(e) => {
                        e.currentTarget.src = defaultBanner;
                      }}
                    />
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {/* Ticket Modal */}
      {activeTicket && (
        <QrTicketModal ticket={activeTicket} onClose={() => setActiveTicket(null)} />
      )}
    </div>
  );
}
