import React, { useState, useEffect } from 'react';
import { 
  PlusCircle, 
  BarChart3, 
  Edit3, 
  Users, 
  Clock, 
  CheckCircle2, 
  X, 
  Calendar, 
  MapPin, 
  ShieldAlert, 
  Sparkles, 
  ArrowRight 
} from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import * as eventService from '../services/eventService';
import * as checkinService from '../services/checkinService';
import LoadingSpinner from '../components/LoadingSpinner';
import ErrorMessage from '../components/ErrorMessage';
import StatusBadge from '../components/StatusBadge';
import CapacityBar from '../components/CapacityBar';

export default function OrganizerDashboardPage() {
  const { user, isOrganizer, switchRole } = useAuth();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Modals state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingEvent, setEditingEvent] = useState(null);
  const [statsEvent, setStatsEvent] = useState(null);
  const [statsData, setStatsData] = useState(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [attendeesModalEvent, setAttendeesModalEvent] = useState(null);
  const [attendeesList, setAttendeesList] = useState([]);
  const [attendeesLoading, setAttendeesLoading] = useState(false);

  // Form state
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
      // Show all events or events managed by this organizer
      setEvents(res.events || []);
    } catch (err) {
      console.error('Failed to load organizer events:', err);
      setError(err.message || 'Unable to retrieve events.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrganizerEvents();
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
        ...formData,
        capacity: Number(formData.capacity),
        startAt: new Date(formData.startAt).toISOString(),
        endAt: formData.endAt ? new Date(formData.endAt).toISOString() : undefined,
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
      setFormError(err.message || 'Failed to save event details.');
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

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', marginBottom: '2rem' }}>
        <div>
          <h1 style={{ fontSize: '2rem', marginBottom: '0.25rem' }}>Organizer Dashboard</h1>
          <p style={{ color: 'var(--text-secondary)' }}>
            Publish campus events, manage capacities, monitor registrations, and track venue attendance.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          {!isOrganizer && (
            <button
              onClick={() => switchRole('ORGANIZER')}
              className="btn btn-secondary btn-sm"
              style={{ borderColor: 'rgba(236, 72, 153, 0.4)', color: '#f472b6' }}
            >
              <Sparkles size={14} />
              Switch to Organizer Role
            </button>
          )}

          <button onClick={openCreateModal} className="btn btn-primary">
            <PlusCircle size={18} />
            Create Event
          </button>
        </div>
      </div>

      {/* Role Reminder if not in Organizer role */}
      {!isOrganizer && (
        <div style={{ marginBottom: '1.5rem', padding: '1rem 1.25rem', borderRadius: 'var(--radius-md)', background: 'rgba(236, 72, 153, 0.1)', border: '1px solid rgba(236, 72, 153, 0.3)', color: '#fbcfe8', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem' }}>
            <ShieldAlert size={18} style={{ color: '#f472b6' }} />
            <span>You are currently viewing as <strong>{user?.role || 'Attendee'}</strong>. Click 'Switch to Organizer Role' to enable full creation/editing permissions.</span>
          </div>
          <button onClick={() => switchRole('ORGANIZER')} className="btn btn-sm btn-primary" style={{ flexShrink: 0 }}>
            Activate Role
          </button>
        </div>
      )}

      {/* Events Table / Cards */}
      {loading ? (
        <LoadingSpinner message="Loading organizer events..." />
      ) : error ? (
        <ErrorMessage title="Error fetching events" message={error} onRetry={fetchOrganizerEvents} />
      ) : events.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '1rem' }}>No events published yet.</p>
          <button onClick={openCreateModal} className="btn btn-primary">
            Create Your First Event
          </button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '1.5rem' }}>
          {events.map((event) => (
            <div key={event.eventId} className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem' }}>
                <span className="category-pill">{event.category || 'General'}</span>
                <span className="status-badge badge-active">{event.status || 'PUBLISHED'}</span>
              </div>

              <h3 style={{ fontSize: '1.25rem', lineHeight: 1.3 }}>{event.title}</h3>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Calendar size={14} style={{ color: 'var(--accent-primary)' }} />
                  <span>{new Date(event.startAt).toLocaleDateString()}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <MapPin size={14} style={{ color: 'var(--accent-secondary)' }} />
                  <span>{event.venue || 'Campus Venue'}</span>
                </div>
              </div>

              <CapacityBar confirmed={event.confirmedCount} capacity={event.capacity} />

              {/* Action Buttons */}
              <div style={{ marginTop: 'auto', paddingTop: '0.75rem', borderTop: '1px solid var(--border-subtle)', display: 'flex', gap: '0.5rem' }}>
                <button
                  onClick={() => viewStats(event)}
                  className="btn btn-sm btn-primary"
                  style={{ flex: 1 }}
                >
                  <BarChart3 size={14} />
                  Analytics
                </button>
                <button
                  onClick={() => viewAttendees(event)}
                  className="btn btn-sm btn-secondary"
                  title="View Attendee List"
                >
                  <Users size={14} />
                  Attendees
                </button>
                <button
                  onClick={() => openEditModal(event)}
                  className="btn btn-sm btn-outline"
                  title="Edit Event"
                >
                  <Edit3 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create / Edit Modal */}
      {showCreateModal && (
        <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '580px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h2 style={{ fontSize: '1.25rem' }}>
                {editingEvent ? 'Edit Event Details' : 'Create Campus Event'}
              </h2>
              <button onClick={() => setShowCreateModal(false)} style={{ color: 'var(--text-muted)' }}>
                <X size={20} />
              </button>
            </div>

            {formError && (
              <div style={{ marginBottom: '1rem', padding: '0.75rem', background: 'rgba(239, 68, 68, 0.12)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: 'var(--radius-md)', color: '#fca5a5', fontSize: '0.8125rem' }}>
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
                  <label className="form-label">Maximum Capacity *</label>
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
                      Minimum {editingEvent.confirmedCount} (cannot reduce below confirmed RSVPs)
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
                <label className="form-label">Venue / Location *</label>
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
                  placeholder="Describe event agenda, prerequisites, speaker highlights..."
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="form-textarea"
                  required
                />
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
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
                  {formSubmitting ? 'Saving...' : editingEvent ? 'Save Changes' : 'Publish Event'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Analytics & Stats Modal */}
      {statsEvent && (
        <div className="modal-overlay" onClick={() => setStatsEvent(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '520px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <div>
                <span style={{ fontSize: '0.75rem', color: '#a5b4fc', textTransform: 'uppercase', fontWeight: 700 }}>
                  Live Event Analytics
                </span>
                <h3 style={{ fontSize: '1.25rem', marginTop: '0.15rem' }}>{statsEvent.title}</h3>
              </div>
              <button onClick={() => setStatsEvent(null)} style={{ color: 'var(--text-muted)' }}>
                <X size={20} />
              </button>
            </div>

            {statsLoading ? (
              <LoadingSpinner message="Calculating capacity and attendance metrics..." />
            ) : statsData ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem' }}>
                  <div style={{ background: 'rgba(15, 23, 42, 0.7)', padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Capacity</div>
                    <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-primary)' }}>{statsData.capacity}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Total Allocated Seats</div>
                  </div>

                  <div style={{ background: 'rgba(16, 185, 129, 0.1)', padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid rgba(16, 185, 129, 0.3)' }}>
                    <div style={{ fontSize: '0.75rem', color: '#34d399', textTransform: 'uppercase' }}>Confirmed RSVPs</div>
                    <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#34d399' }}>{statsData.confirmedCount}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Active Bookings</div>
                  </div>

                  <div style={{ background: 'rgba(245, 158, 11, 0.1)', padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid rgba(245, 158, 11, 0.3)' }}>
                    <div style={{ fontSize: '0.75rem', color: '#fbbf24', textTransform: 'uppercase' }}>Waitlist</div>
                    <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#fbbf24' }}>{statsData.waitlistCount}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>In FIFO Queue</div>
                  </div>

                  <div style={{ background: 'rgba(59, 130, 246, 0.1)', padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid rgba(59, 130, 246, 0.3)' }}>
                    <div style={{ fontSize: '0.75rem', color: '#60a5fa', textTransform: 'uppercase' }}>Checked In</div>
                    <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#60a5fa' }}>{statsData.checkedInCount}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Venue Arrivals</div>
                  </div>
                </div>

                {/* Attendance Percentage Ring/Bar */}
                <div style={{ background: 'rgba(15, 23, 42, 0.7)', padding: '1.25rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                    <span style={{ fontWeight: 600, fontSize: '0.875rem' }}>Attendance Rate</span>
                    <span style={{ fontWeight: 800, color: '#60a5fa', fontSize: '1.125rem' }}>{statsData.attendancePercentage}%</span>
                  </div>
                  <div className="capacity-bar-track">
                    <div className="capacity-bar-fill capacity-safe" style={{ width: `${statsData.attendancePercentage}%`, background: 'linear-gradient(90deg, #3b82f6, #6366f1)' }} />
                  </div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.35rem', display: 'block' }}>
                    {statsData.checkedInCount} of {statsData.confirmedCount} confirmed attendees checked in.
                  </span>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}

      {/* Attendees List Modal */}
      {attendeesModalEvent && (
        <div className="modal-overlay" onClick={() => setAttendeesModalEvent(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '640px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <div>
                <span style={{ fontSize: '0.75rem', color: '#a5b4fc', textTransform: 'uppercase', fontWeight: 700 }}>
                  Attendee Registry
                </span>
                <h3 style={{ fontSize: '1.25rem', marginTop: '0.15rem' }}>{attendeesModalEvent.title}</h3>
              </div>
              <button onClick={() => setAttendeesModalEvent(null)} style={{ color: 'var(--text-muted)' }}>
                <X size={20} />
              </button>
            </div>

            {attendeesLoading ? (
              <LoadingSpinner message="Retrieving attendee records..." />
            ) : attendeesList.length === 0 ? (
              <p style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '2rem 0' }}>
                No attendees registered yet.
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: '400px', overflowY: 'auto' }}>
                {attendeesList.map((a) => (
                  <div key={a.ticketId} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem 1rem', background: 'rgba(15, 23, 42, 0.7)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '0.9375rem' }}>{a.attendeeName}</div>
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
