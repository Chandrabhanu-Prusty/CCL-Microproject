import React from 'react';
import { Link } from 'react-router-dom';
import { Calendar, MapPin, ArrowRight } from 'lucide-react';
import CapacityBar from './CapacityBar';

export default function EventCard({ event }) {
  if (!event) return null;

  const isFull = event.confirmedCount >= event.capacity;
  const formattedDate = event.startAt
    ? new Date(event.startAt).toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : 'TBA';

  const defaultBanner =
    'https://images.unsplash.com/photo-1540575467063-178a50c2df87?auto=format&fit=crop&w=800&q=80';

  return (
    <div className="card card-hoverable" style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: '0', overflow: 'hidden' }}>
      {/* Event Banner */}
      <div style={{ position: 'relative', height: '180px', overflow: 'hidden', background: '#1e293b' }}>
        <img
          src={event.bannerUrl || defaultBanner}
          alt={event.title}
          style={{ width: '100%', height: '100%', objectFit: 'cover', transition: 'transform 0.4s ease' }}
          onError={(e) => {
            e.currentTarget.src = defaultBanner;
          }}
        />
        <div style={{ position: 'absolute', top: '0.875rem', left: '0.875rem' }}>
          <span className="category-pill" style={{ background: 'rgba(11, 15, 25, 0.75)', backdropFilter: 'blur(8px)', borderColor: 'rgba(255, 255, 255, 0.15)', color: '#fff' }}>
            {event.category || 'General'}
          </span>
        </div>
        {isFull && (
          <div style={{ position: 'absolute', top: '0.875rem', right: '0.875rem' }}>
            <span className="status-badge badge-waitlisted" style={{ backdropFilter: 'blur(8px)' }}>
              Waitlist Only
            </span>
          </div>
        )}
      </div>

      {/* Event Details */}
      <div style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', flex: 1, gap: '0.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8125rem', color: 'var(--accent-primary)', fontWeight: 600 }}>
          <Calendar size={14} />
          <span>{formattedDate}</span>
        </div>

        <h3 style={{ fontSize: '1.125rem', lineHeight: 1.35, flex: 1 }}>
          <Link to={`/events/${event.eventId}`} style={{ color: 'var(--text-primary)' }}>
            {event.title}
          </Link>
        </h3>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
          <MapPin size={14} style={{ flexShrink: 0, color: 'var(--text-muted)' }} />
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {event.venue || 'Campus Venue'}
          </span>
        </div>

        {/* Capacity Bar */}
        <CapacityBar confirmed={event.confirmedCount} capacity={event.capacity} />

        {/* CTA Button */}
        <div style={{ marginTop: 'auto', paddingTop: '0.5rem' }}>
          <Link
            to={`/events/${event.eventId}`}
            className={`btn ${isFull ? 'btn-secondary' : 'btn-primary'}`}
            style={{ width: '100%' }}
          >
            <span>{isFull ? 'Join Waitlist' : 'RSVP Free'}</span>
            <ArrowRight size={15} />
          </Link>
        </div>
      </div>
    </div>
  );
}
