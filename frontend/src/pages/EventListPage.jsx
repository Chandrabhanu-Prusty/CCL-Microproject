import React, { useState, useEffect } from 'react';
import { Search, Filter, Sparkles } from 'lucide-react';
import EventCard from '../components/EventCard';
import LoadingSpinner from '../components/LoadingSpinner';
import EmptyState from '../components/EmptyState';
import ErrorMessage from '../components/ErrorMessage';
import * as eventService from '../services/eventService';

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
      setError(err.message || 'Unable to load campus events. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchEvents();
    }, 250);
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
      {/* Hero Section */}
      <section style={{ textAlign: 'center', padding: '2.5rem 0 3rem' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(99, 102, 241, 0.12)', border: '1px solid rgba(99, 102, 241, 0.3)', borderRadius: 'var(--radius-full)', padding: '0.35rem 0.875rem', marginBottom: '1.25rem', fontSize: '0.8125rem', fontWeight: 600, color: '#a5b4fc' }}>
          <Sparkles size={14} style={{ color: 'var(--accent-secondary)' }} />
          Campus Event Discovery & Digital Ticketing
        </div>

        <h1 style={{ fontSize: 'clamp(2rem, 5vw, 3.25rem)', lineHeight: 1.15, marginBottom: '1rem' }}>
          Discover, RSVP, and Experience <br />
          <span style={{ background: 'var(--accent-gradient)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            Campus Life with Marque
          </span>
        </h1>

        <p style={{ maxWidth: '640px', margin: '0 auto', color: 'var(--text-secondary)', fontSize: '1.0625rem', lineHeight: 1.6 }}>
          Explore official campus events, lock in your free RSVP with capacity protection, join instant waitlists, and check in effortlessly with your digital QR ticket.
        </p>

        {/* Search & Filter Bar */}
        <div style={{ maxWidth: '720px', margin: '2.5rem auto 0', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ position: 'relative' }}>
            <Search size={20} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              type="text"
              placeholder="Search events by title, keyword, or venue..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="form-input"
              style={{ paddingLeft: '2.85rem', height: '52px', fontSize: '1rem', borderRadius: 'var(--radius-full)' }}
            />
          </div>

          {/* Category Chips & Filter Controls */}
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem' }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
              {CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`btn btn-sm ${selectedCategory === cat ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ borderRadius: 'var(--radius-full)' }}
                >
                  {cat}
                </button>
              ))}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Filter size={15} style={{ color: 'var(--text-muted)' }} />
              <select
                value={availabilityFilter}
                onChange={(e) => setAvailabilityFilter(e.target.value)}
                className="form-select"
                style={{ width: 'auto', padding: '0.35rem 0.75rem', fontSize: '0.8125rem', borderRadius: 'var(--radius-full)' }}
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
      <section style={{ marginTop: '1.5rem' }}>
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
            description="Try clearing your search query or switching categories to see upcoming activities."
            actionLabel="Reset Filters"
            onAction={() => {
              setSearchQuery('');
              setSelectedCategory('All');
              setAvailabilityFilter('ALL');
            }}
          />
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.5rem' }}>
            {filteredEvents.map((event) => (
              <EventCard key={event.eventId} event={event} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
