import React from 'react';
import { Link } from 'react-router-dom';
import { Calendar, MapPin, ArrowRight, Users, Clock } from 'lucide-react';
import CapacityBar from './CapacityBar';

export default function EventCard({ event }) {
  if (!event) return null;

  const isFull = event.confirmedCount >= event.capacity;
  const formattedDate = event.startAt
    ? new Date(event.startAt).toLocaleString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : 'TBA';

  const defaultBanner =
    'https://images.unsplash.com/photo-1540575467063-178a50c2df87?auto=format&fit=crop&w=800&q=80';

  return (
    <div className="card card-hoverable" style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: '0', overflow: 'hidden', background: '#191921', borderColor: 'var(--border-subtle)' }}>
      {/* Event Banner with Overlay */}
      <div style={{ position: 'relative', height: '190px', overflow: 'hidden', background: '#121218' }}>
        <img
          src={event.bannerUrl || defaultBanner}
          alt={event.title}
          style={{ width: '100%', height: '100%', objectFit: 'cover', transition: 'transform 0.45s ease' }}
          onError={(e) => {
            e.currentTarget.src = defaultBanner;
          }}
        />
        {/* Subtle dark gradient overlay to ensure badge contrast */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'linear-gradient(180deg, rgba(10, 10, 13, 0.45) 0%, rgba(10, 10, 13, 0.75) 100%)',
          }}
        />

        <div style={{ position: 'absolute', top: '0.85rem', left: '0.85rem' }}>
          <span
            className="category-pill"
            style={{
              background: 'rgba(10, 10, 13, 0.85)',
              backdropFilter: 'blur(8px)',
              borderColor: 'rgba(255, 255, 255, 0.15)',
              color: '#ffffff',
              fontWeight: 700,
            }}
          >
            {event.category || 'General'}
          </span>
        </div>

        <div style={{ position: 'absolute', top: '0.85rem', right: '0.85rem' }}>
          {isFull ? (
            <span className="status-badge badge-waitlisted" style={{ backdropFilter: 'blur(8px)' }}>
              Waitlist Only
            </span>
          ) : (
            <span className="status-badge badge-confirmed" style={{ backdropFilter: 'blur(8px)' }}>
              Spots Available
            </span>
          )}
        </div>
      </div>

      {/* Event Details */}
      <div style={{ padding: '1.35rem', display: 'flex', flexDirection: 'column', flex: 1, gap: '0.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontSize: '0.825rem', color: 'var(--accent-primary)', fontWeight: 600 }}>
          <Calendar size={14} />
          <span>{formattedDate}</span>
        </div>

        <h3 style={{ fontSize: '1.18rem', lineHeight: 1.35, flex: 1 }}>
          <Link
            to={`/events/${event.eventId}`}
            style={{ color: 'var(--text-primary)', transition: 'color var(--transition-fast)' }}
          >
            {event.title}
          </Link>
        </h3>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontSize: '0.825rem', color: 'var(--text-secondary)' }}>
          <MapPin size={14} style={{ flexShrink: 0, color: 'var(--accent-secondary)' }} />
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {event.venue || 'Campus Venue'}
          </span>
        </div>

        {/* Capacity Bar */}
        <CapacityBar confirmed={event.confirmedCount} capacity={event.capacity} />

        {/* CTA Button */}
        <div style={{ marginTop: 'auto', paddingTop: '0.65rem' }}>
          <Link
            to={`/events/${event.eventId}`}
            className={`btn ${isFull ? 'btn-secondary' : 'btn-primary'}`}
            style={{
              width: '100%',
              borderColor: isFull ? 'rgba(255, 138, 61, 0.4)' : undefined,
              color: isFull ? '#ff9a54' : '#ffffff',
            }}
          >
            <span>{isFull ? 'Join Waitlist' : 'RSVP Free'}</span>
            <ArrowRight size={15} />
          </Link>
        </div>
      </div>
    </div>
  );
}
