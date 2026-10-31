import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Search, 
  Filter, 
  BarChart3, 
  Edit3, 
  Users, 
  Calendar, 
  MapPin, 
  X, 
  ShieldAlert, 
  Sparkles,
  CheckCircle2,
  TrendingUp,
  UserCheck
} from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import * as eventService from '../services/eventService';
import * as checkinService from '../services/checkinService';
import EventRow from '../components/EventRow';
import LoadingSpinner from '../components/LoadingSpinner';
import ErrorMessage from '../components/ErrorMessage';
import StatusBadge from '../components/StatusBadge';

const CATEGORIES = ['All', 'Technology', 'Workshop', 'Cultural', 'Academic', 'Sports'];

export default function OrganizerDashboardPage() {
  const { user, isOrganizer, switchRole, isMockMode } = useAuth();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Search & filter
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');

  // Modals state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingEvent, setEditingEvent] = useState(null);
  const [statsEvent, setStatsEvent] = useState(null);
  const [statsData, setStatsData] = useState(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [attendeesModalEvent, setAttendeesModalEvent] = useState(null);
  const [attendeesList, setAttendeesList] = useState([]);
  const [attendeesLoading, setAttendeesLoading] = useState(false);

  // Form state (matching API_CONTRACT.md)
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    category: 'Technology',
    startAt: '',
    endAt: '',
    venue: '',
    capacity: 100,
    bannerUrl: '',
  });
  const [formError, setFormError] = useState(null);
  const [formSubmitting, setFormSubmitting] = useState(false);

  const fetchOrganizerEvents = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await eventService.getEvents();
      setEvents(res.events || []);
    } catch (err) {
      console.error('Failed to load organizer events:', err);
      setError(err.message || 'Unable to retrieve events from backend.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrganizerEvents();
  }, []);

  // Listen for "+ New Event" event from top header
  useEffect(() => {
    const handleOpenCreate = () => {
      openCreateModal();
    };
    window.addEventListener('marque:open-create-event', handleOpenCreate);
    return () => window.removeEventListener('marque:open-create-event', handleOpenCreate);
  }, []);

  const openCreateModal = () => {
    setEditingEvent(null);
    setFormData({
      title: '',
      description: '',
      category: 'Technology',
      startAt: new Date(Date.now() + 86400000).toISOString().slice(0, 16),
      endAt: new Date(Date.now() + 90000000).toISOString().slice(0, 16),
      venue: '',
      capacity: 100,
      bannerUrl: '',
    });
    setFormError(null);
    setShowCreateModal(true);
  };

  const openEditModal = (event) => {
    setEditingEvent(event);
    setFormData({
      title: event.title,
      description: event.description,
      category: event.category || 'Technology',
      startAt: event.startAt ? new Date(event.startAt).toISOString().slice(0, 16) : '',
      endAt: event.endAt ? new Date(event.endAt).toISOString().slice(0, 16) : '',
      venue: event.venue,
      capacity: event.capacity,
      bannerUrl: event.bannerUrl || '',
    });
    setFormError(null);
    setShowCreateModal(true);
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    setFormError(null);
    setFormSubmitting(true);

    try {
      const payload = {
        title: formData.title.trim(),
        description: formData.description.trim(),
        category: formData.category,
        capacity: Number(formData.capacity),
        venue: formData.venue.trim(),
        startAt: new Date(formData.startAt).toISOString(),
        endAt: formData.endAt ? new Date(formData.endAt).toISOString() : undefined,
        bannerUrl: formData.bannerUrl.trim() || undefined,
      };

      if (editingEvent) {
        // PATCH /api/events/{eventId}
        await eventService.updateEvent(editingEvent.eventId, payload);
      } else {
        // POST /api/events
        await eventService.createEvent(payload);
      }

      setShowCreateModal(false);
      await fetchOrganizerEvents();
    } catch (err) {
      console.error('Save event error:', err);
      setFormError(err.message || 'Failed to save event details. Please verify capacity and required fields.');
    } finally {
      setFormSubmitting(false);
    }
  };

  const viewStats = async (event) => {
    setStatsEvent(event);
    setStatsLoading(true);
    try {
      const res = await checkinService.getEventStats(event.eventId);
      setStatsData(res);
    } catch (err) {
      console.error('Failed to load stats:', err);
    } finally {
      setStatsLoading(false);
    }
  };

  const viewAttendees = async (event) => {
    setAttendeesModalEvent(event);
    setAttendeesLoading(true);
    try {
      const res = await checkinService.getAttendees(event.eventId);
      setAttendeesList(res.attendees || []);
    } catch (err) {
      console.error('Failed to load attendees:', err);
    } finally {
      setAttendeesLoading(false);
    }
  };

  const filteredEvents = events.filter((e) => {
    const matchesQuery = !searchQuery || 
      e.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (e.venue && e.venue.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesCategory = selectedCategory === 'All' || e.category === selectedCategory;
    return matchesQuery && matchesCategory;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Page Header (GDG Style: "Events" + "+ New Event" Button) */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '1rem' }}>
        <div>
          <h2 style={{ fontSize: '1.5rem', marginBottom: '0.25rem' }}>Events</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
            Manage campus event schedules, capacity allocations, registrations, and venue check-in records.
          </p>
        </div>

        <button onClick={openCreateModal} className="btn btn-primary">
          <Plus size={16} />
          <span>New Event</span>
        </button>
      </div>

      {/* Role Notice when user is not in ORGANIZER role */}
      {!isOrganizer && (
        <div style={{ padding: '0.85rem 1.15rem', borderRadius: 'var(--radius-sm)', background: 'rgba(240, 182, 90, 0.12)', border: '1px solid rgba(240, 182, 90, 0.35)', color: 'var(--status-warning)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', fontSize: '0.875rem' }}>
            <ShieldAlert size={18} style={{ flexShrink: 0 }} />
            <span>
              You are signed in as <strong>{user?.role || 'Attendee'}</strong>. Event creation and editing requires the <strong>ORGANIZER</strong> role.
            </span>
          </div>
          {isMockMode && (
            <button
              onClick={() => switchRole('ORGANIZER')}
              className="btn btn-sm btn-secondary"
              style={{ color: 'var(--status-warning)', borderColor: 'rgba(240, 182, 90, 0.4)' }}
            >
              <UserCheck size={14} />
              <span>Switch to Organizer Persona</span>
            </button>
          )}
        </div>
      )}

      {/* Search & Filter Toolbar */}
      <div className="filter-toolbar">
        <div className="search-box">
          <Search size={16} />
          <input
            type="text"
            placeholder="Search managed events by title or venue..."
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
      </div>

      {/* Event Management List (GDG Horizontal Event Rows) */}
      <section aria-label="Event Management List">
        {loading ? (
          <LoadingSpinner message="Retrieving managed events..." />
        ) : error ? (
          <ErrorMessage title="Error fetching events" message={error} onRetry={fetchOrganizerEvents} />
        ) : filteredEvents.length === 0 ? (
          <div className="card" style={{ textAlign: 'center', padding: '3.5rem 1.5rem' }}>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '1rem', fontSize: '0.9375rem' }}>
              {searchQuery ? 'No events found matching your search.' : 'No events published yet.'}
            </p>
            <button onClick={openCreateModal} className="btn btn-primary">
              <Plus size={16} />
              <span>Create Your First Event</span>
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {filteredEvents.map((event) => (
              <EventRow
                key={event.eventId}
                event={event}
                variant="organizer"
                onEdit={openEditModal}
                onViewStats={viewStats}
                onViewAttendees={viewAttendees}
              />
            ))}
          </div>
        )}
      </section>

      {/* Create / Edit Modal (Matching API_CONTRACT.md fields) */}
      {showCreateModal && (
        <div className="modal-overlay" onClick={() => setShowCreateModal(false)} role="dialog" aria-modal="true" aria-labelledby="event-form-title">
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '600px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.75rem' }}>
              <h2 id="event-form-title" style={{ fontSize: '1.25rem' }}>
                {editingEvent ? 'Edit Campus Event' : 'Create New Campus Event'}
              </h2>
              <button onClick={() => setShowCreateModal(false)} aria-label="Close dialog" style={{ color: 'var(--text-muted)' }}>
                <X size={18} />
              </button>
            </div>

            {formError && (
              <div style={{ marginBottom: '1rem', padding: '0.75rem', background: 'var(--status-error-bg)', border: '1px solid var(--status-error-border)', borderRadius: 'var(--radius-sm)', color: 'var(--status-error)', fontSize: '0.8125rem' }}>
                {formError}
              </div>
            )}

            <form onSubmit={handleFormSubmit}>
              <div className="form-group">
                <label className="form-label">Event Title *</label>
                <input
                  type="text"
                  placeholder="e.g. Cloud Canvas Hackathon 2026"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="form-input"
                  required
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="form-group">
                  <label className="form-label">Category *</label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="form-select"
                  >
                    <option value="Technology">Technology</option>
                    <option value="Workshop">Workshop</option>
                    <option value="Cultural">Cultural</option>
                    <option value="Academic">Academic</option>
                    <option value="Sports">Sports</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Capacity (Seats) *</label>
                  <input
                    type="number"
                    min={editingEvent ? editingEvent.confirmedCount : 1}
                    value={formData.capacity}
                    onChange={(e) => setFormData({ ...formData, capacity: e.target.value })}
                    className="form-input"
                    required
                  />
                  {editingEvent && (
                    <span className="form-helper">
                      Min {editingEvent.confirmedCount} (cannot reduce below confirmed RSVPs)
                    </span>
                  )}
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="form-group">
                  <label className="form-label">Start Date & Time *</label>
                  <input
                    type="datetime-local"
                    value={formData.startAt}
                    onChange={(e) => setFormData({ ...formData, startAt: e.target.value })}
                    className="form-input"
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">End Date & Time</label>
                  <input
                    type="datetime-local"
                    value={formData.endAt}
                    onChange={(e) => setFormData({ ...formData, endAt: e.target.value })}
                    className="form-input"
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Venue Location *</label>
                <input
                  type="text"
                  placeholder="e.g. Auditorium & Lab 502, VESIT Campus"
                  value={formData.venue}
                  onChange={(e) => setFormData({ ...formData, venue: e.target.value })}
                  className="form-input"
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Banner Image URL (Optional)</label>
                <input
                  type="url"
                  placeholder="https://images.unsplash.com/..."
                  value={formData.bannerUrl}
                  onChange={(e) => setFormData({ ...formData, bannerUrl: e.target.value })}
                  className="form-input"
                />
              </div>

              <div className="form-group">
                <label className="form-label">Description *</label>
                <textarea
                  rows={4}
                  placeholder="Describe the event format, speaker bios, rules, and prerequisites..."
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="form-textarea"
                  required
                />
              </div>

              <div style={{ display: 'flex', gap: '0.65rem', justifyContent: 'flex-end', marginTop: '1.25rem', borderTop: '1px solid var(--border-subtle)', paddingTop: '1rem' }}>
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="btn btn-secondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formSubmitting}
                  className="btn btn-primary"
                >
                  {formSubmitting ? 'Saving...' : editingEvent ? 'Update Event' : 'Publish Event'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Analytics & Stats Modal */}
      {statsEvent && (
        <div className="modal-overlay" onClick={() => setStatsEvent(null)} role="dialog" aria-modal="true" aria-labelledby="stats-modal-title">
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '520px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.75rem' }}>
              <div>
                <span style={{ fontSize: '0.6875rem', color: 'var(--accent-pink)', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.05em' }}>
                  Live Attendance Analytics
                </span>
                <h3 id="stats-modal-title" style={{ fontSize: '1.15rem', marginTop: '0.15rem' }}>
                  {statsEvent.title}
                </h3>
              </div>
              <button onClick={() => setStatsEvent(null)} aria-label="Close analytics modal" style={{ color: 'var(--text-muted)' }}>
                <X size={18} />
              </button>
            </div>

            {statsLoading ? (
              <LoadingSpinner message="Calculating capacity & check-in metrics..." />
            ) : statsData ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.75rem' }}>
                  <div style={{ background: '#14151B', padding: '0.85rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
                    <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Capacity</div>
                    <div style={{ fontSize: '1.65rem', fontWeight: 800, color: 'var(--text-primary)' }}>{statsData.capacity}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Total Allocated Seats</div>
                  </div>

                  <div style={{ background: 'var(--status-success-bg)', padding: '0.85rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--status-success-border)' }}>
                    <div style={{ fontSize: '0.6875rem', color: 'var(--status-success)', textTransform: 'uppercase', fontWeight: 600 }}>Confirmed RSVPs</div>
                    <div style={{ fontSize: '1.65rem', fontWeight: 800, color: 'var(--status-success)' }}>{statsData.confirmedCount}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Active Registrations</div>
                  </div>

                  <div style={{ background: 'var(--status-warning-bg)', padding: '0.85rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--status-warning-border)' }}>
                    <div style={{ fontSize: '0.6875rem', color: 'var(--status-warning)', textTransform: 'uppercase', fontWeight: 600 }}>Waitlist</div>
                    <div style={{ fontSize: '1.65rem', fontWeight: 800, color: 'var(--status-warning)' }}>{statsData.waitlistCount}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>In FIFO Queue</div>
                  </div>

                  <div style={{ background: 'var(--status-info-bg)', padding: '0.85rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--status-info-border)' }}>
                    <div style={{ fontSize: '0.6875rem', color: 'var(--status-info)', textTransform: 'uppercase', fontWeight: 600 }}>Checked In</div>
                    <div style={{ fontSize: '1.65rem', fontWeight: 800, color: 'var(--status-info)' }}>{statsData.checkedInCount}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Admitted Attendees</div>
                  </div>
                </div>

                {/* Attendance Rate */}
                <div style={{ background: '#14151B', padding: '1rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                    <span style={{ fontWeight: 600, fontSize: '0.8125rem' }}>Attendance Turnout</span>
                    <span style={{ fontWeight: 800, color: 'var(--status-info)', fontSize: '1.125rem' }}>{statsData.attendancePercentage}%</span>
                  </div>
                  <div className="capacity-bar-track">
                    <div 
                      className="capacity-bar-fill" 
                      style={{ 
                        width: `${statsData.attendancePercentage}%`, 
                        background: 'linear-gradient(90deg, #F04F8B, #FF984F)' 
                      }} 
                    />
                  </div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.4rem', display: 'block' }}>
                    {statsData.checkedInCount} of {statsData.confirmedCount} confirmed ticket holders arrived.
                  </span>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}

      {/* Attendees List Modal */}
      {attendeesModalEvent && (
        <div className="modal-overlay" onClick={() => setAttendeesModalEvent(null)} role="dialog" aria-modal="true" aria-labelledby="attendees-modal-title">
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '640px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.75rem' }}>
              <div>
                <span style={{ fontSize: '0.6875rem', color: 'var(--accent-orange)', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.05em' }}>
                  Attendee Registry
                </span>
                <h3 id="attendees-modal-title" style={{ fontSize: '1.15rem', marginTop: '0.15rem' }}>
                  {attendeesModalEvent.title}
                </h3>
              </div>
              <button onClick={() => setAttendeesModalEvent(null)} aria-label="Close attendee modal" style={{ color: 'var(--text-muted)' }}>
                <X size={18} />
              </button>
            </div>

            {attendeesLoading ? (
              <LoadingSpinner message="Retrieving attendee records..." />
            ) : attendeesList.length === 0 ? (
              <p style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '2rem 0', fontSize: '0.875rem' }}>
                No attendees registered yet for this event.
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '400px', overflowY: 'auto' }}>
                {attendeesList.map((a) => (
                  <div 
                    key={a.ticketId} 
                    style={{ 
                      display: 'flex', 
                      justifyContent: 'space-between', 
                      alignItems: 'center', 
                      padding: '0.65rem 0.85rem', 
                      background: '#14151B', 
                      borderRadius: 'var(--radius-sm)', 
                      border: '1px solid var(--border-subtle)' 
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>{a.attendeeName}</div>
                      <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>{a.attendeeEmail}</div>
                      <div style={{ color: 'var(--text-muted)', fontSize: '0.6875rem', fontFamily: 'monospace', marginTop: '0.2rem' }}>
                        ID: {a.ticketId}
                      </div>
                    </div>
                    <StatusBadge status={a.status} />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
