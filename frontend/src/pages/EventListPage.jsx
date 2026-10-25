import React, { useState, useEffect } from 'react';
import { Search, Filter, Sparkles, X, Shield, Calendar, QrCode } from 'lucide-react';
import EventCard from '../components/EventCard';
import LoadingSpinner from '../components/LoadingSpinner';
import EmptyState from '../components/EmptyState';
import ErrorMessage from '../components/ErrorMessage';
import * as eventService from '../services/eventService';
import { isMockMode } from '../services/apiClient';

const CATEGORIES = ['All', 'Technology', 'Workshop', 'Cultural', 'Academic'];

export default function EventListPage() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [availabilityFilter, setAvailabilityFilter] = useState('ALL'); // ALL, AVAILABLE, FULL

  const fetchEvents = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await eventService.getEvents({
        q: searchQuery,
        category: selectedCategory === 'All' ? '' : selectedCategory,
      });
      setEvents(res.events || []);
    } catch (err) {
      console.error('Failed to load events:', err);
      setError(err.message || 'Unable to load campus events. Please verify backend connection.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchEvents();
    }, 200);
    return () => clearTimeout(timer);
  }, [searchQuery, selectedCategory]);

  const filteredEvents = events.filter((e) => {
    if (availabilityFilter === 'AVAILABLE') {
      return e.confirmedCount < e.capacity;
    }
    if (availabilityFilter === 'FULL') {
      return e.confirmedCount >= e.capacity;
    }
    return true;
  });

  return (
    <div>
      {/* Demo Mode Badge */}
      {isMockMode && (
        <div
          style={{
            maxWidth: '680px',
            margin: '0 auto 1.5rem',
            padding: '0.45rem 1rem',
            borderRadius: 'var(--radius-full)',
            background: 'rgba(255, 138, 61, 0.08)',
            border: '1px solid rgba(255, 138, 61, 0.25)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.5rem',
            fontSize: '0.75rem',
            color: 'var(--accent-secondary)',
          }}
        >
          <Sparkles size={13} />
          <span>Local Demo Mode Active — Using simulated campus data. Connect API Gateway for live backend events.</span>
        </div>
      )}

      {/* Hero Section */}
      <section style={{ textAlign: 'center', padding: '1.5rem 0 3rem' }}>
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.5rem',
            background: 'rgba(255, 61, 141, 0.1)',
            border: '1px solid rgba(255, 61, 141, 0.3)',
            borderRadius: 'var(--radius-full)',
            padding: '0.4rem 1rem',
            marginBottom: '1.25rem',
            fontSize: '0.825rem',
            fontWeight: 600,
            color: '#ff8a3d',
            letterSpacing: '0.02em',
          }}
        >
          <Sparkles size={14} style={{ color: 'var(--accent-primary)' }} />
          <span>Official Campus Event Discovery & QR Passes</span>
        </div>

        <h1 style={{ fontSize: 'clamp(2.2rem, 5.5vw, 3.5rem)', lineHeight: 1.15, marginBottom: '1.25rem', fontWeight: 800 }}>
          Discover, RSVP, and Experience <br />
          <span style={{ background: 'var(--accent-gradient)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            Campus Life with Marque
          </span>
        </h1>

        <p style={{ maxWidth: '640px', margin: '0 auto 2rem', color: 'var(--text-secondary)', fontSize: '1.05rem', lineHeight: 1.65 }}>
          Explore official workshops, hackathons, and cultural gatherings. Lock in your verified RSVP with capacity safety, join automated waitlists, and present digital single-use QR tickets at the venue.
        </p>

        {/* Value Highlights */}
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '1.25rem', marginBottom: '2.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontSize: '0.825rem', color: 'var(--text-secondary)', background: 'rgba(255, 255, 255, 0.03)', border: '1px solid var(--border-subtle)', padding: '0.35rem 0.85rem', borderRadius: 'var(--radius-full)' }}>
            <Shield size={14} style={{ color: 'var(--accent-primary)' }} />
            <span>Capacity-Enforced RSVPs</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontSize: '0.825rem', color: 'var(--text-secondary)', background: 'rgba(255, 255, 255, 0.03)', border: '1px solid var(--border-subtle)', padding: '0.35rem 0.85rem', borderRadius: 'var(--radius-full)' }}>
            <QrCode size={14} style={{ color: 'var(--accent-secondary)' }} />
            <span>Opaque Single-Use QR Pass</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontSize: '0.825rem', color: 'var(--text-secondary)', background: 'rgba(255, 255, 255, 0.03)', border: '1px solid var(--border-subtle)', padding: '0.35rem 0.85rem', borderRadius: 'var(--radius-full)' }}>
            <Calendar size={14} style={{ color: '#34d399' }} />
            <span>FIFO Automated Waitlist</span>
          </div>
        </div>

        {/* Search & Filter Bar */}
        <div style={{ maxWidth: '740px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div style={{ position: 'relative' }}>
            <Search size={20} style={{ position: 'absolute', left: '1.25rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              type="text"
              placeholder="Search by event title, topic, speaker, or campus venue..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="form-input"
              style={{
                paddingLeft: '3.1rem',
                paddingRight: searchQuery ? '3rem' : '1.25rem',
                height: '54px',
                fontSize: '1rem',
                borderRadius: 'var(--radius-full)',
                background: '#191921',
                border: '1.5px solid var(--border-subtle)',
              }}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                aria-label="Clear search"
                style={{ position: 'absolute', right: '1.25rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}
              >
                <X size={18} />
              </button>
            )}
          </div>

          {/* Category Chips & Filter Controls */}
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '0.85rem' }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.45rem' }}>
              {CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`btn btn-sm ${selectedCategory === cat ? 'btn-primary' : 'btn-secondary'}`}
                  style={{
                    borderRadius: 'var(--radius-full)',
                    fontSize: '0.8rem',
                    padding: '0.4rem 0.95rem',
                  }}
                >
                  {cat}
                </button>
              ))}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Filter size={15} style={{ color: 'var(--accent-secondary)' }} />
              <select
                value={availabilityFilter}
                onChange={(e) => setAvailabilityFilter(e.target.value)}
                className="form-select"
                style={{
                  width: 'auto',
                  padding: '0.4rem 0.85rem',
                  fontSize: '0.8rem',
                  borderRadius: 'var(--radius-full)',
                  background: '#191921',
                }}
              >
                <option value="ALL">All Availabilities</option>
                <option value="AVAILABLE">Open Spots Only</option>
                <option value="FULL">Waitlist Active</option>
              </select>
            </div>
          </div>
        </div>
      </section>

      {/* Events Grid Section */}
      <section style={{ marginTop: '1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <div>
            <h2 style={{ fontSize: '1.4rem' }}>Upcoming Events</h2>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              Showing {filteredEvents.length} {filteredEvents.length === 1 ? 'event' : 'events'}
              {selectedCategory !== 'All' ? ` in ${selectedCategory}` : ''}
            </p>
          </div>
        </div>

        {loading ? (
          <LoadingSpinner message="Fetching campus events..." />
        ) : error ? (
          <ErrorMessage 
            title="Failed to retrieve events" 
            message={error} 
            onRetry={fetchEvents} 
          />
        ) : filteredEvents.length === 0 ? (
          <EmptyState
            title="No events match your criteria"
            description="Try clearing your search query or switching categories to discover upcoming campus activities."
            actionLabel="Reset Filters"
            onAction={() => {
              setSearchQuery('');
              setSelectedCategory('All');
              setAvailabilityFilter('ALL');
            }}
          />
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1.75rem' }}>
            {filteredEvents.map((event) => (
              <EventCard key={event.eventId} event={event} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
