import React, { useState, useEffect } from 'react';
import { Search, Filter, X, LayoutList, LayoutGrid, Calendar, MapPin, Users, ArrowRight } from 'lucide-react';
import EventRow from '../components/EventRow';
import EventCard from '../components/EventCard';
import LoadingSpinner from '../components/LoadingSpinner';
import EmptyState from '../components/EmptyState';
import ErrorMessage from '../components/ErrorMessage';
import * as eventService from '../services/eventService';

const CATEGORIES = ['All', 'Technology', 'Workshop', 'Cultural', 'Academic', 'Sports'];

export default function EventListPage() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [availabilityFilter, setAvailabilityFilter] = useState('ALL'); // ALL, AVAILABLE, FULL
  const [viewMode, setViewMode] = useState('horizontal'); // 'horizontal' (default GDG style) | 'grid'

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
      setError(err.message || 'Unable to load campus events. Please verify backend connectivity.');
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Compact Page Heading */}
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '1rem' }}>
        <div>
          <h2 style={{ fontSize: '1.5rem', marginBottom: '0.25rem' }}>Discover Events</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
            Explore official campus hackathons, technical workshops, and student community gatherings.
          </p>
        </div>

        {/* View Mode Toggle */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', background: 'var(--bg-card)', padding: '0.25rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-default)' }}>
          <button
            onClick={() => setViewMode('horizontal')}
            className={`btn btn-sm ${viewMode === 'horizontal' ? 'btn-secondary' : 'btn-ghost'}`}
            title="Horizontal List View"
            aria-label="Horizontal list view"
            style={{ padding: '0.35rem 0.55rem' }}
          >
            <LayoutList size={15} />
          </button>
          <button
            onClick={() => setViewMode('grid')}
            className={`btn btn-sm ${viewMode === 'grid' ? 'btn-secondary' : 'btn-ghost'}`}
            title="Grid View"
            aria-label="Grid view"
            style={{ padding: '0.35rem 0.55rem' }}
          >
            <LayoutGrid size={15} />
          </button>
        </div>
      </div>

      {/* Search & Filter Toolbar */}
      <div className="filter-toolbar">
        <div className="search-box">
          <Search size={16} />
          <input
            type="text"
            placeholder="Search by event title, keyword, or venue..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="form-input"
            aria-label="Search events"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              aria-label="Clear search"
              style={{ position: 'absolute', right: '0.85rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}
            >
              <X size={15} />
            </button>
          )}
        </div>

        <div className="filter-group">
          <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`btn btn-sm ${selectedCategory === cat ? 'btn-primary' : 'btn-secondary'}`}
                style={{ fontSize: '0.75rem', padding: '0.35rem 0.65rem' }}
              >
                {cat}
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', borderLeft: '1px solid var(--border-subtle)', paddingLeft: '0.5rem' }}>
            <Filter size={14} style={{ color: 'var(--text-muted)' }} />
            <select
              value={availabilityFilter}
              onChange={(e) => setAvailabilityFilter(e.target.value)}
              className="form-select"
              aria-label="Filter by availability"
              style={{ width: 'auto', padding: '0.35rem 0.65rem', fontSize: '0.75rem' }}
            >
              <option value="ALL">All Availabilities</option>
              <option value="AVAILABLE">Open Spots Only</option>
              <option value="FULL">Waitlist Active</option>
            </select>
          </div>
        </div>
      </div>

      {/* Listing Content */}
      <section aria-label="Upcoming Events List">
        {loading ? (
          <LoadingSpinner message="Loading upcoming events..." />
        ) : error ? (
          <ErrorMessage 
            title="Failed to retrieve events" 
            message={error} 
            onRetry={fetchEvents} 
          />
        ) : filteredEvents.length === 0 ? (
          <EmptyState
            title="No events match your criteria"
            description="Try adjusting your keywords or switching category filters."
            actionLabel="Reset All Filters"
            onAction={() => {
              setSearchQuery('');
              setSelectedCategory('All');
              setAvailabilityFilter('ALL');
            }}
          />
        ) : viewMode === 'horizontal' ? (
          /* GDG-style Horizontal Event Rows */
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {filteredEvents.map((event) => (
              <EventRow key={event.eventId} event={event} variant="attendee" />
            ))}
          </div>
        ) : (
          /* Grid View Option */
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.25rem' }}>
            {filteredEvents.map((event) => (
              <EventCard key={event.eventId} event={event} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
