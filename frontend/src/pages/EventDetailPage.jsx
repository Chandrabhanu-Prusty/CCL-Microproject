import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { 
  Calendar, 
  MapPin, 
  Users, 
  CheckCircle, 
  Clock, 
  Ticket, 
  AlertCircle, 
  ArrowLeft, 
  ShieldCheck, 
  X,
  Sparkles,
  Info
} from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import * as eventService from '../services/eventService';
import * as rsvpService from '../services/rsvpService';
import CapacityBar from '../components/CapacityBar';
import StatusBadge from '../components/StatusBadge';
import QrTicketModal from '../components/QrTicketModal';
import LoadingSpinner from '../components/LoadingSpinner';
import ErrorMessage from '../components/ErrorMessage';

export default function EventDetailPage() {
  const { eventId } = useParams();
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();

  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const [userRsvp, setUserRsvp] = useState(null);
  const [activeTicket, setActiveTicket] = useState(null);
  const [showTicketModal, setShowTicketModal] = useState(false);

  const loadEventAndRsvp = async () => {
    try {
      setLoading(true);
      setError(null);
      const eventRes = await eventService.getEventById(eventId);
      setEvent(eventRes.event);

      if (isAuthenticated) {
        const rsvpRes = await rsvpService.getMyRsvps();
        const existing = rsvpRes.rsvps?.find(
          (r) => r.eventId === eventId && r.status !== 'CANCELLED'
        );
        setUserRsvp(existing || null);

        if (existing?.ticketId) {
          setActiveTicket({
            ticketId: existing.ticketId,
            eventId: eventRes.event.eventId,
            eventTitle: eventRes.event.title,
            eventVenue: eventRes.event.venue,
            eventStartAt: eventRes.event.startAt,
            attendeeName: user?.name || 'Campus Attendee',
            attendeeEmail: user?.email || '',
            status: 'ACTIVE',
          });
        }
      }
    } catch (err) {
      console.error('Failed to load event details:', err);
      setError(err.message || 'Unable to retrieve event details from backend.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEventAndRsvp();
  }, [eventId, isAuthenticated]);

  const handleRsvp = async () => {
    if (!isAuthenticated) {
      navigate('/auth', { state: { from: `/events/${eventId}` } });
      return;
    }

    try {
      setActionLoading(true);
      setFeedback(null);
      const result = await rsvpService.rsvpEvent(eventId);

      if (result.status === 'CONFIRMED') {
        setFeedback({
          type: 'success',
          message: 'RSVP Confirmed! Your official digital QR ticket has been issued below.',
        });
        if (result.ticketId) {
          const ticketData = {
            ticketId: result.ticketId,
            eventId: event.eventId,
            eventTitle: event.title,
            eventVenue: event.venue,
            eventStartAt: event.startAt,
            attendeeName: user.name,
            attendeeEmail: user.email,
            status: 'ACTIVE',
          };
          setActiveTicket(ticketData);
          setShowTicketModal(true);
        }
      } else if (result.status === 'WAITLISTED') {
        setFeedback({
          type: 'warning',
          message: `Event is at full capacity. You are in queue at position #${result.queuePosition}. If an RSVP cancels, you will be auto-promoted!`,
        });
      }
      await loadEventAndRsvp();
    } catch (err) {
      console.error('RSVP submission failed:', err);
      setFeedback({
        type: 'error',
        message: err.message || 'Failed to submit RSVP. Please try again.',
      });
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancelRsvp = async () => {
    if (!window.confirm('Are you sure you want to cancel this registration? Your reserved ticket will be released.')) {
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
      setUserRsvp(null);
      setActiveTicket(null);
      await loadEventAndRsvp();
    } catch (err) {
      console.error('Cancellation failed:', err);
      setFeedback({
        type: 'error',
        message: err.message || 'Failed to cancel registration.',
      });
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return <LoadingSpinner message="Loading event details..." />;
  }

  if (error || !event) {
    return (
      <div style={{ maxWidth: '640px', margin: '2rem auto' }}>
        <Link to="/events" className="btn btn-sm btn-secondary" style={{ marginBottom: '1.5rem', display: 'inline-flex' }}>
          <ArrowLeft size={16} /> Back to Events
        </Link>
        <ErrorMessage title="Event Not Available" message={error || 'The requested event could not be found.'} onRetry={loadEventAndRsvp} />
      </div>
    );
  }

  const isFull = event.confirmedCount >= event.capacity;
  const formattedDate = event.startAt
    ? new Date(event.startAt).toLocaleString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : 'TBA';

  const defaultBanner =
    'https://images.unsplash.com/photo-1540575467063-178a50c2df87?auto=format&fit=crop&w=1200&q=80';

  return (
    <div style={{ maxWidth: '1040px', margin: '0 auto' }}>
      {/* Back button */}
      <Link to="/events" className="btn btn-sm btn-secondary" style={{ marginBottom: '1.5rem', display: 'inline-flex' }}>
        <ArrowLeft size={16} /> Back to Events
      </Link>

      {/* Banner Card */}
      <div
        style={{
          position: 'relative',
          height: '380px',
          borderRadius: 'var(--radius-xl)',
          overflow: 'hidden',
          marginBottom: '2rem',
          boxShadow: 'var(--shadow-card)',
          border: '1px solid var(--border-subtle)',
          background: '#121218',
        }}
      >
        <img
          src={event.bannerUrl || defaultBanner}
          alt={event.title}
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          onError={(e) => {
            e.currentTarget.src = defaultBanner;
          }}
        />
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'linear-gradient(180deg, rgba(10, 10, 13, 0.2) 20%, rgba(10, 10, 13, 0.95) 100%)',
          }}
        />
        <div style={{ position: 'absolute', bottom: '1.75rem', left: '1.75rem', right: '1.75rem' }}>
          <span
            className="category-pill"
            style={{
              background: 'rgba(255, 61, 141, 0.2)',
              borderColor: 'rgba(255, 61, 141, 0.45)',
              color: '#ffffff',
              fontWeight: 700,
              marginBottom: '0.85rem',
              display: 'inline-block',
            }}
          >
            {event.category || 'General'}
          </span>
          <h1 style={{ fontSize: 'clamp(1.85rem, 4.5vw, 2.75rem)', color: '#ffffff', lineHeight: 1.2 }}>
            {event.title}
          </h1>
        </div>
      </div>

      {/* Status Feedback Banner */}
      {feedback && (
        <div
          style={{
            marginBottom: '1.75rem',
            padding: '1rem 1.25rem',
            borderRadius: 'var(--radius-md)',
            background:
              feedback.type === 'success'
                ? 'rgba(16, 185, 129, 0.12)'
                : feedback.type === 'warning'
                ? 'rgba(255, 138, 61, 0.12)'
                : 'rgba(239, 68, 68, 0.12)',
            border: `1px solid ${
              feedback.type === 'success'
                ? 'rgba(16, 185, 129, 0.35)'
                : feedback.type === 'warning'
                ? 'rgba(255, 138, 61, 0.35)'
                : 'rgba(239, 68, 68, 0.35)'
            }`,
            color:
              feedback.type === 'success'
                ? '#34d399'
                : feedback.type === 'warning'
                ? '#ff9a54'
                : '#f87171',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '0.75rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', fontSize: '0.925rem', fontWeight: 600 }}>
            {feedback.type === 'success' ? (
              <CheckCircle size={18} />
            ) : feedback.type === 'warning' ? (
              <Clock size={18} />
            ) : (
              <AlertCircle size={18} />
            )}
            <span>{feedback.message}</span>
          </div>
          <button onClick={() => setFeedback(null)} aria-label="Dismiss feedback" style={{ color: 'inherit' }}>
            <X size={16} />
          </button>
        </div>
      )}

      {/* Grid: Event Details & Action Card */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '2rem', alignItems: 'start' }}>
        {/* Left Column: Details */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
          <div>
            <h2 style={{ fontSize: '1.25rem', marginBottom: '1.25rem', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.65rem' }}>
              Schedule & Venue
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.15rem' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.85rem' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: 'var(--radius-sm)', background: 'rgba(255, 61, 141, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent-primary)', flexShrink: 0 }}>
                  <Calendar size={18} />
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>Date & Time</div>
                  <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>{formattedDate}</div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.85rem' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: 'var(--radius-sm)', background: 'rgba(255, 138, 61, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent-secondary)', flexShrink: 0 }}>
                  <MapPin size={18} />
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>Campus Venue</div>
                  <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>{event.venue || 'Campus Venue'}</div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.85rem' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: 'var(--radius-sm)', background: 'rgba(16, 185, 129, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#34d399', flexShrink: 0 }}>
                  <Users size={18} />
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>Capacity Allocation</div>
                  <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                    {event.capacity} total seats ({event.confirmedCount} confirmed bookings)
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div>
            <h2 style={{ fontSize: '1.25rem', marginBottom: '0.85rem', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.65rem' }}>
              About the Event
            </h2>
            <p style={{ color: 'var(--text-secondary)', lineHeight: 1.75, fontSize: '0.95rem', whiteSpace: 'pre-line' }}>
              {event.description}
            </p>
          </div>
        </div>

        {/* Right Column: RSVP & Pass Action Card */}
        <div className="card" style={{ position: 'sticky', top: '5.5rem', display: 'flex', flexDirection: 'column', gap: '1.35rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.775rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)' }}>
              Pass Status
            </span>
            {userRsvp ? (
              <StatusBadge status={userRsvp.status} />
            ) : isFull ? (
              <span className="status-badge badge-waitlisted">Waitlist Active</span>
            ) : (
              <span className="status-badge badge-confirmed">Free RSVP Open</span>
            )}
          </div>

          <CapacityBar confirmed={event.confirmedCount} capacity={event.capacity} />

          {/* User Registration States */}
          {userRsvp ? (
            <div
              style={{
                background: '#14141b',
                borderRadius: 'var(--radius-md)',
                padding: '1.35rem',
                border: '1px solid var(--border-subtle)',
                display: 'flex',
                flexDirection: 'column',
                gap: '1rem',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                {userRsvp.status === 'CONFIRMED' ? (
                  <CheckCircle size={20} style={{ color: '#34d399', flexShrink: 0 }} />
                ) : (
                  <Clock size={20} style={{ color: '#ff9a54', flexShrink: 0 }} />
                )}
                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>
                    {userRsvp.status === 'CONFIRMED' ? 'Confirmed Pass Active' : `In Waitlist (Position #${userRsvp.queuePosition || 1})`}
                  </div>
                  <div style={{ fontSize: '0.775rem', color: 'var(--text-muted)' }}>
                    {userRsvp.status === 'CONFIRMED'
                      ? 'Present digital QR ticket at venue entrance'
                      : 'You will be notified and promoted if a spot frees up'}
                  </div>
                </div>
              </div>

              {userRsvp.status === 'CONFIRMED' && activeTicket && (
                <button
                  onClick={() => setShowTicketModal(true)}
                  className="btn btn-primary"
                  style={{ width: '100%', height: '44px' }}
                >
                  <Ticket size={16} />
                  <span>View Digital QR Ticket</span>
                </button>
              )}

              <button
                onClick={handleCancelRsvp}
                disabled={actionLoading}
                className="btn btn-danger btn-sm"
                style={{ width: '100%' }}
              >
                Cancel Registration
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {!isAuthenticated && (
                <div style={{ fontSize: '0.825rem', color: 'var(--text-secondary)', background: 'rgba(255, 61, 141, 0.08)', border: '1px solid rgba(255, 61, 141, 0.2)', padding: '0.75rem', borderRadius: 'var(--radius-sm)' }}>
                  Sign in or register to claim your free pass for this event.
                </div>
              )}

              <button
                onClick={handleRsvp}
                disabled={actionLoading}
                className={`btn btn-lg ${isFull ? 'btn-secondary' : 'btn-primary'}`}
                style={{
                  width: '100%',
                  borderColor: isFull ? 'rgba(255, 138, 61, 0.4)' : undefined,
                  color: isFull ? '#ff9a54' : '#ffffff',
                }}
              >
                {actionLoading ? (
                  <span>Processing...</span>
                ) : isFull ? (
                  <>
                    <Clock size={18} />
                    <span>Join Free Waitlist</span>
                  </>
                ) : (
                  <>
                    <Ticket size={18} />
                    <span>Claim Free RSVP Pass</span>
                  </>
                )}
              </button>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                <ShieldCheck size={14} style={{ color: 'var(--accent-primary)', flexShrink: 0 }} />
                <span>Single-use opaque QR code issued automatically on confirmation.</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Ticket Modal */}
      {showTicketModal && activeTicket && (
        <QrTicketModal ticket={activeTicket} onClose={() => setShowTicketModal(false)} />
      )}
    </div>
  );
}
