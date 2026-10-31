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
  LogIn,
  User,
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
            status: existing.status === 'CONFIRMED' ? 'ACTIVE' : existing.status,
          });
        } else {
          setActiveTicket(null);
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
          message: 'RSVP Confirmed! Your official digital QR ticket has been issued.',
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
    if (!window.confirm('Are you sure you want to cancel this registration? Your reserved ticket will be released to the next attendee.')) {
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
        <Link to="/events" className="btn btn-sm btn-secondary" style={{ marginBottom: '1.25rem' }}>
          <ArrowLeft size={15} /> Back to Events
        </Link>
        <ErrorMessage 
          title="Event Not Found" 
          message={error || 'The requested campus event could not be found.'} 
          onRetry={loadEventAndRsvp} 
        />
      </div>
    );
  }

  const isFull = event.confirmedCount >= event.capacity;
  const defaultBanner = 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?auto=format&fit=crop&w=1200&q=80';

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

  const formattedEndDate = event.endAt
    ? new Date(event.endAt).toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
      })
    : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', maxWidth: '1080px', margin: '0 auto' }}>
      {/* Back link */}
      <div>
        <Link to="/events" className="btn btn-sm btn-secondary" style={{ display: 'inline-flex' }}>
          <ArrowLeft size={15} /> Back to All Events
        </Link>
      </div>

      {/* Large Event Banner */}
      <div style={{ position: 'relative', height: '320px', borderRadius: 'var(--radius-md)', overflow: 'hidden', border: '1px solid var(--border-default)', background: '#14151B' }}>
        <img
          src={event.bannerUrl || defaultBanner}
          alt={event.title}
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          onError={(e) => {
            e.currentTarget.src = defaultBanner;
          }}
        />
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, transparent 40%, rgba(13, 14, 18, 0.95) 100%)' }} />
        
        <div style={{ position: 'absolute', bottom: '1.25rem', left: '1.5rem', right: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.45rem' }}>
            <span className="category-pill">{event.category || 'General'}</span>
            <span className="tag-free">Free RSVP</span>
            {isFull ? (
              <span className="status-badge badge-waitlisted">Waitlist Active</span>
            ) : (
              <span className="status-badge badge-confirmed">Open</span>
            )}
          </div>
          <h1 style={{ fontSize: 'clamp(1.5rem, 3.5vw, 2.25rem)', color: '#fff', lineHeight: 1.25 }}>
            {event.title}
          </h1>
        </div>
      </div>

      {/* Feedback Banner */}
      {feedback && (
        <div
          style={{
            padding: '0.85rem 1.15rem',
            borderRadius: 'var(--radius-sm)',
            background: feedback.type === 'success' ? 'var(--status-success-bg)' : feedback.type === 'warning' ? 'var(--status-warning-bg)' : 'var(--status-error-bg)',
            border: `1px solid ${feedback.type === 'success' ? 'var(--status-success-border)' : feedback.type === 'warning' ? 'var(--status-warning-border)' : 'var(--status-error-border)'}`,
            color: feedback.type === 'success' ? 'var(--status-success)' : feedback.type === 'warning' ? 'var(--status-warning)' : 'var(--status-error)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '0.75rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', fontWeight: 600 }}>
            {feedback.type === 'success' ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
            <span>{feedback.message}</span>
          </div>
          <button onClick={() => setFeedback(null)} aria-label="Dismiss feedback" style={{ color: 'inherit' }}>
            <X size={16} />
          </button>
        </div>
      )}

      {/* Two Column Layout: Event Details & Sticky RSVP Action Panel */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 340px', gap: '1.75rem', alignItems: 'start' }}>
        {/* Left: Metadata & Description */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Key Event Facts */}
          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <h2 style={{ fontSize: '1.125rem', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.5rem' }}>
              Schedule & Location
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
                <Calendar size={18} style={{ color: 'var(--accent-pink)', flexShrink: 0, marginTop: '2px' }} />
                <div>
                  <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>Date & Time</div>
                  <div style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
                    {formattedDate} {formattedEndDate ? `— ${formattedEndDate}` : ''}
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
                <MapPin size={18} style={{ color: 'var(--accent-orange)', flexShrink: 0, marginTop: '2px' }} />
                <div>
                  <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>Venue</div>
                  <div style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
                    {event.venue || 'Campus Venue'}
                  </div>
                </div>
              </div>

              {event.organizerId && (
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
                  <User size={18} style={{ color: 'var(--status-info)', flexShrink: 0, marginTop: '2px' }} />
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>Organized By</div>
                    <div style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
                      Campus Event Lead ({event.organizerId})
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Description */}
          <div className="card">
            <h2 style={{ fontSize: '1.125rem', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.5rem', marginBottom: '0.85rem' }}>
              About This Event
            </h2>
            <div style={{ color: 'var(--text-secondary)', fontSize: '0.9375rem', lineHeight: 1.65, whiteSpace: 'pre-line' }}>
              {event.description || 'No detailed description provided for this campus event.'}
            </div>
          </div>
        </div>

        {/* Right: Sticky RSVP Action Panel */}
        <aside className="card" style={{ position: 'sticky', top: '75px', display: 'flex', flexDirection: 'column', gap: '1.15rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)' }}>
              Registration
            </span>
            <span className="tag-free">Free Entry</span>
          </div>

          <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '0.85rem' }}>
            <div style={{ marginBottom: '0.5rem', fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
              Capacity & Availability:
            </div>
            <CapacityBar confirmed={event.confirmedCount} capacity={event.capacity} />
          </div>

          {/* Dynamic Registration States */}
          <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {!isAuthenticated ? (
              /* State: Not Signed In */
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
                  Sign in with your campus account to claim a free ticket or enter the waitlist.
                </p>
                <button
                  onClick={() => navigate('/auth', { state: { from: `/events/${eventId}` } })}
                  className="btn btn-primary"
                  style={{ width: '100%' }}
                >
                  <LogIn size={15} />
                  <span>Sign In to RSVP</span>
                </button>
              </div>
            ) : userRsvp?.status === 'CONFIRMED' ? (
              /* State: Confirmed */
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', background: '#14151B', padding: '1rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--status-success)', fontWeight: 600, fontSize: '0.875rem' }}>
                  <CheckCircle size={17} />
                  <span>You are Registered!</span>
                </div>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  Your digital QR pass is ready for venue entrance.
                </p>

                {activeTicket && (
                  <button
                    onClick={() => setShowTicketModal(true)}
                    className="btn btn-primary btn-sm"
                    style={{ width: '100%' }}
                  >
                    <Ticket size={14} />
                    <span>View Digital Ticket</span>
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
            ) : userRsvp?.status === 'WAITLISTED' ? (
              /* State: Waitlisted */
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', background: '#14151B', padding: '1rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--status-warning)', fontWeight: 600, fontSize: '0.875rem' }}>
                  <Clock size={17} />
                  <span>In Waitlist Queue</span>
                </div>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                  Queue Position: <strong>#{userRsvp.queuePosition || 1}</strong>. If an attendee cancels, your ticket will be generated automatically.
                </p>
                <button
                  onClick={handleCancelRsvp}
                  disabled={actionLoading}
                  className="btn btn-danger btn-sm"
                  style={{ width: '100%' }}
                >
                  Leave Waitlist
                </button>
              </div>
            ) : (
              /* State: Available seats or Full */
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <button
                  onClick={handleRsvp}
                  disabled={actionLoading}
                  className={`btn ${isFull ? 'btn-secondary' : 'btn-primary'}`}
                  style={{ width: '100%' }}
                >
                  {actionLoading ? (
                    <span>Processing...</span>
                  ) : isFull ? (
                    <>
                      <Clock size={16} />
                      <span>Join Free Waitlist</span>
                    </>
                  ) : (
                    <>
                      <Ticket size={16} />
                      <span>RSVP Free</span>
                    </>
                  )}
                </button>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  <ShieldCheck size={14} style={{ color: 'var(--accent-pink)', flexShrink: 0 }} />
                  <span>Immediate single-use QR pass generation upon confirmation.</span>
                </div>
              </div>
            )}
          </div>
        </aside>
      </div>

      {/* Ticket Modal */}
      {showTicketModal && activeTicket && (
        <QrTicketModal ticket={activeTicket} onClose={() => setShowTicketModal(false)} />
      )}
    </div>
  );
}
