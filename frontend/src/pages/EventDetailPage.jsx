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
  X 
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
  const [feedback, setFeedback] = useState(null); // { type: 'success' | 'warning' | 'error', message: '' }
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
            attendeeName: user.name,
            attendeeEmail: user.email,
            status: 'ACTIVE',
          });
        }
      }
    } catch (err) {
      console.error('Failed to load event details:', err);
      setError(err.message || 'Unable to retrieve event details.');
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
      // Actual API call to backend
      const result = await rsvpService.rsvpEvent(eventId);

      // Display actual backend status
      if (result.status === 'CONFIRMED') {
        setFeedback({
          type: 'success',
          message: 'RSVP Confirmed! Your official QR ticket is ready below.',
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
          message: `Event reached full capacity. You are at Queue Position #${result.queuePosition} in the waitlist. If a spot opens, you will be auto-promoted!`,
        });
      }
      // Refresh event status and capacity
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
    if (!window.confirm('Are you sure you want to cancel your registration? This action will release your ticket.')) {
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
      <div>
        <Link to="/events" className="btn btn-sm btn-secondary" style={{ marginBottom: '1.5rem' }}>
          <ArrowLeft size={16} /> Back to Events
        </Link>
        <ErrorMessage title="Event not found" message={error || 'The requested event could not be found.'} onRetry={loadEventAndRsvp} />
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

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
      {/* Back button */}
      <Link to="/events" className="btn btn-sm btn-secondary" style={{ marginBottom: '1.5rem', display: 'inline-flex' }}>
        <ArrowLeft size={16} /> Back to Events
      </Link>

      {/* Banner */}
      <div style={{ position: 'relative', height: '360px', borderRadius: 'var(--radius-xl)', overflow: 'hidden', marginBottom: '2rem', boxShadow: 'var(--shadow-card)' }}>
        <img
          src={event.bannerUrl || 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?auto=format&fit=crop&w=1200&q=80'}
          alt={event.title}
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, transparent 40%, rgba(11, 15, 25, 0.95) 100%)' }} />
        <div style={{ position: 'absolute', bottom: '1.5rem', left: '1.5rem', right: '1.5rem' }}>
          <span className="category-pill" style={{ background: 'rgba(99, 102, 241, 0.25)', borderColor: 'rgba(99, 102, 241, 0.4)', color: '#fff', marginBottom: '0.75rem', display: 'inline-block' }}>
            {event.category || 'General'}
          </span>
          <h1 style={{ fontSize: 'clamp(1.75rem, 4vw, 2.5rem)', color: '#fff', textShadow: '0 2px 8px rgba(0,0,0,0.6)' }}>
            {event.title}
          </h1>
        </div>
      </div>

      {/* Status Alert Banner if any */}
      {feedback && (
        <div
          style={{
            marginBottom: '1.5rem',
            padding: '1rem 1.25rem',
            borderRadius: 'var(--radius-md)',
            background: feedback.type === 'success' ? 'rgba(16, 185, 129, 0.15)' : feedback.type === 'warning' ? 'rgba(245, 158, 11, 0.15)' : 'rgba(239, 68, 68, 0.15)',
            border: `1px solid ${feedback.type === 'success' ? 'rgba(16, 185, 129, 0.4)' : feedback.type === 'warning' ? 'rgba(245, 158, 11, 0.4)' : 'rgba(239, 68, 68, 0.4)'}`,
            color: feedback.type === 'success' ? '#34d399' : feedback.type === 'warning' ? '#fbbf24' : '#f87171',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '0.75rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9375rem', fontWeight: 500 }}>
            {feedback.type === 'success' ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
            <span>{feedback.message}</span>
          </div>
          <button onClick={() => setFeedback(null)} style={{ color: 'inherit' }}>
            <X size={16} />
          </button>
        </div>
      )}

      {/* Grid: Details on Left, RSVP Action Card on Right */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '2rem', alignItems: 'start' }}>
        {/* Left: Event Description & Meta */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div>
            <h2 style={{ fontSize: '1.25rem', marginBottom: '1rem', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.5rem' }}>
              Event Information
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
                <Calendar size={20} style={{ color: 'var(--accent-primary)', flexShrink: 0, marginTop: '2px' }} />
                <div>
                  <div style={{ fontWeight: 600 }}>Date & Time</div>
                  <div style={{ color: 'var(--text-secondary)', fontSize: '0.9375rem' }}>{formattedDate}</div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
                <MapPin size={20} style={{ color: 'var(--accent-secondary)', flexShrink: 0, marginTop: '2px' }} />
                <div>
                  <div style={{ fontWeight: 600 }}>Venue Location</div>
                  <div style={{ color: 'var(--text-secondary)', fontSize: '0.9375rem' }}>{event.venue || 'Campus Venue'}</div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
                <Users size={20} style={{ color: '#10b981', flexShrink: 0, marginTop: '2px' }} />
                <div>
                  <div style={{ fontWeight: 600 }}>Event Capacity</div>
                  <div style={{ color: 'var(--text-secondary)', fontSize: '0.9375rem' }}>
                    {event.capacity} total seats ({event.confirmedCount} confirmed)
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div>
            <h2 style={{ fontSize: '1.25rem', marginBottom: '0.75rem', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.5rem' }}>
              About This Event
            </h2>
            <p style={{ color: 'var(--text-secondary)', lineHeight: 1.7, fontSize: '0.9375rem', whiteSpace: 'pre-line' }}>
              {event.description}
            </p>
          </div>
        </div>

        {/* Right: RSVP & Ticket Registration Card */}
        <div className="card" style={{ position: 'sticky', top: '5.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.8125rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)' }}>
              Registration Status
            </span>
            {userRsvp ? (
              <StatusBadge status={userRsvp.status} />
            ) : isFull ? (
              <span className="status-badge badge-waitlisted">Waitlist Only</span>
            ) : (
              <span className="status-badge badge-confirmed">Free RSVP Open</span>
            )}
          </div>

          <CapacityBar confirmed={event.confirmedCount} capacity={event.capacity} />

          {/* User Registration States */}
          {userRsvp ? (
            <div style={{ background: 'rgba(15, 23, 42, 0.7)', borderRadius: 'var(--radius-md)', padding: '1.25rem', border: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                {userRsvp.status === 'CONFIRMED' ? (
                  <CheckCircle size={18} style={{ color: '#34d399' }} />
                ) : (
                  <Clock size={18} style={{ color: '#fbbf24' }} />
                )}
                <span style={{ fontWeight: 600, fontSize: '0.9375rem' }}>
                  {userRsvp.status === 'CONFIRMED' ? 'You are registered!' : `In Waitlist (Position #${userRsvp.queuePosition || 1})`}
                </span>
              </div>

              {userRsvp.status === 'CONFIRMED' && activeTicket && (
                <button
                  onClick={() => setShowTicketModal(true)}
                  className="btn btn-primary"
                  style={{ width: '100%' }}
                >
                  <Ticket size={16} />
                  View Digital QR Ticket
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
              <button
                onClick={handleRsvp}
                disabled={actionLoading}
                className={`btn btn-lg ${isFull ? 'btn-secondary' : 'btn-primary'}`}
                style={{ width: '100%' }}
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
                    <span>RSVP for Free</span>
                  </>
                )}
              </button>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                <ShieldCheck size={14} style={{ color: 'var(--accent-primary)' }} />
                Capacity-protected instant booking. Single-use QR issued upon confirmation.
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
