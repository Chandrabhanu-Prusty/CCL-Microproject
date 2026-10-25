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
  ArrowRight,
  TrendingUp,
  Ticket
} from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import * as eventService from '../services/eventService';
import * as checkinService from '../services/checkinService';
import LoadingSpinner from '../components/LoadingSpinner';
import ErrorMessage from '../components/ErrorMessage';
import StatusBadge from '../components/StatusBadge';
import CapacityBar from '../components/CapacityBar';

export default function OrganizerDashboardPage() {
  const { user, isOrganizer, switchRole, isMockMode } = useAuth();
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
        await eventService.updateEvent(editingEvent.eventId, payload);
      } else {
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
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '1.25rem', marginBottom: '2rem' }}>
        <div>
          <h1 style={{ fontSize: '2.15rem', marginBottom: '0.35rem' }}>Organizer Dashboard</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
            Publish campus events, manage capacities, monitor registrations, and inspect live venue attendance.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          {isMockMode && !isOrganizer && (
            <button
              onClick={() => switchRole('ORGANIZER')}
              className="btn btn-secondary btn-sm"
              style={{ borderColor: 'rgba(255, 61, 141, 0.4)', color: '#ff3d8d' }}
            >
              <Sparkles size={14} />
              <span>Switch to Organizer Role</span>
            </button>
          )}

          <button onClick={openCreateModal} className="btn btn-primary">
            <PlusCircle size={18} />
            <span>Create Campus Event</span>
          </button>
        </div>
      </div>

      {/* Role Reminder if not in Organizer role */}
      {!isOrganizer && (
        <div
          style={{
            marginBottom: '1.75rem',
            padding: '1rem 1.25rem',
            borderRadius: 'var(--radius-md)',
            background: 'rgba(255, 61, 141, 0.09)',
            border: '1px solid rgba(255, 61, 141, 0.3)',
            color: '#ffa6cb',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '0.75rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', fontSize: '0.875rem' }}>
            <ShieldAlert size={18} style={{ color: 'var(--accent-primary)', flexShrink: 0 }} />
            <span>
              You are signed in as <strong>{user?.role || 'Attendee'}</strong>.
              {isMockMode
                ? " Click 'Switch to Organizer Role' to simulate event publishing and edits."
                : ' Organizer privileges are required by the backend to create or modify events.'}
            </span>
          </div>
          {isMockMode && (
            <button onClick={() => switchRole('ORGANIZER')} className="btn btn-sm btn-primary" style={{ flexShrink: 0 }}>
              Activate Role
            </button>
          )}
        </div>
      )}

      {/* Events Table / Cards */}
      {loading ? (
        <LoadingSpinner message="Loading organizer events..." />
      ) : error ? (
        <ErrorMessage title="Error fetching events" message={error} onRetry={fetchOrganizerEvents} />
      ) : events.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '3.5rem 2rem', background: '#191921' }}>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '1.25rem', fontSize: '1rem' }}>No events published yet.</p>
          <button onClick={openCreateModal} className="btn btn-primary">
            <PlusCircle size={18} />
            <span>Create Your First Event</span>
          </button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '1.75rem' }}>
          {events.map((event) => (
            <div key={event.eventId} className="card card-hoverable" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', background: '#191921', borderColor: 'var(--border-subtle)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem' }}>
                <span className="category-pill">{event.category || 'General'}</span>
                <span className="status-badge badge-active">{event.status || 'PUBLISHED'}</span>
              </div>

              <h3 style={{ fontSize: '1.25rem', lineHeight: 1.3 }}>{event.title}</h3>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem', fontSize: '0.825rem', color: 'var(--text-secondary)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Calendar size={14} style={{ color: 'var(--accent-primary)' }} />
                  <span>{new Date(event.startAt).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <MapPin size={14} style={{ color: 'var(--accent-secondary)' }} />
                  <span>{event.venue || 'Campus Venue'}</span>
                </div>
              </div>

              <CapacityBar confirmed={event.confirmedCount} capacity={event.capacity} />

              {/* Action Buttons */}
              <div style={{ marginTop: 'auto', paddingTop: '0.85rem', borderTop: '1px solid var(--border-subtle)', display: 'flex', gap: '0.55rem' }}>
                <button
                  onClick={() => viewStats(event)}
                  className="btn btn-sm btn-primary"
                  style={{ flex: 1 }}
                >
                  <BarChart3 size={14} />
                  <span>Analytics</span>
                </button>
                <button
                  onClick={() => viewAttendees(event)}
                  className="btn btn-sm btn-secondary"
                  title="View Attendee List"
                >
                  <Users size={14} />
                  <span>Attendees</span>
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
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '600px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h2 style={{ fontSize: '1.35rem' }}>
                {editingEvent ? 'Edit Event Details' : 'Create Campus Event'}
              </h2>
              <button onClick={() => setShowCreateModal(false)} aria-label="Close modal" style={{ color: 'var(--text-muted)' }}>
                <X size={20} />
              </button>
            </div>

            {formError && (
              <div style={{ marginBottom: '1.25rem', padding: '0.75rem 1rem', background: 'rgba(239, 68, 68, 0.12)', border: '1px solid rgba(239, 68, 68, 0.35)', borderRadius: 'var(--radius-md)', color: '#fca5a5', fontSize: '0.825rem' }}>
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

              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '1.75rem' }}>
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
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '540px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <div>
                <span style={{ fontSize: '0.75rem', color: 'var(--accent-secondary)', textTransform: 'uppercase', fontWeight: 800, letterSpacing: '0.05em' }}>
                  Live Event Analytics
                </span>
                <h3 style={{ fontSize: '1.3rem', marginTop: '0.2rem' }}>{statsEvent.title}</h3>
              </div>
              <button onClick={() => setStatsEvent(null)} aria-label="Close modal" style={{ color: 'var(--text-muted)' }}>
                <X size={20} />
              </button>
            </div>

            {statsLoading ? (
              <LoadingSpinner message="Calculating capacity and attendance metrics..." />
            ) : statsData ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem' }}>
                  <div style={{ background: '#14141b', padding: '1.15rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
                    <div style={{ fontSize: '0.725rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Total Capacity</div>
                    <div style={{ fontSize: '1.85rem', fontWeight: 800, color: 'var(--text-primary)', marginTop: '0.2rem' }}>{statsData.capacity}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Allocated Seats</div>
                  </div>

                  <div style={{ background: 'rgba(16, 185, 129, 0.08)', padding: '1.15rem', borderRadius: 'var(--radius-md)', border: '1px solid rgba(16, 185, 129, 0.3)' }}>
                    <div style={{ fontSize: '0.725rem', color: '#34d399', textTransform: 'uppercase', fontWeight: 600 }}>Confirmed RSVPs</div>
                    <div style={{ fontSize: '1.85rem', fontWeight: 800, color: '#34d399', marginTop: '0.2rem' }}>{statsData.confirmedCount}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Booked Passes</div>
                  </div>

                  <div style={{ background: 'rgba(255, 138, 61, 0.08)', padding: '1.15rem', borderRadius: 'var(--radius-md)', border: '1px solid rgba(255, 138, 61, 0.3)' }}>
                    <div style={{ fontSize: '0.725rem', color: '#ff9a54', textTransform: 'uppercase', fontWeight: 600 }}>Waitlist Queue</div>
                    <div style={{ fontSize: '1.85rem', fontWeight: 800, color: '#ff9a54', marginTop: '0.2rem' }}>{statsData.waitlistCount}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>In FIFO Queue</div>
                  </div>

                  <div style={{ background: 'rgba(59, 130, 246, 0.08)', padding: '1.15rem', borderRadius: 'var(--radius-md)', border: '1px solid rgba(59, 130, 246, 0.3)' }}>
                    <div style={{ fontSize: '0.725rem', color: '#60a5fa', textTransform: 'uppercase', fontWeight: 600 }}>Checked In</div>
                    <div style={{ fontSize: '1.85rem', fontWeight: 800, color: '#60a5fa', marginTop: '0.2rem' }}>{statsData.checkedInCount}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Venue Arrivals</div>
                  </div>
                </div>

                {/* Attendance Rate */}
                <div style={{ background: '#14141b', padding: '1.25rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.65rem' }}>
                    <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>Venue Attendance Rate</span>
                    <span style={{ fontWeight: 800, color: 'var(--accent-primary)', fontSize: '1.25rem' }}>{statsData.attendancePercentage}%</span>
                  </div>
                  <div className="capacity-bar-track" style={{ height: '10px' }}>
                    <div className="capacity-bar-fill" style={{ width: `${statsData.attendancePercentage}%`, background: 'var(--accent-gradient)' }} />
                  </div>
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.5rem', display: 'block' }}>
                    {statsData.checkedInCount} of {statsData.confirmedCount} registered attendees have checked in.
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
                <span style={{ fontSize: '0.75rem', color: 'var(--accent-secondary)', textTransform: 'uppercase', fontWeight: 800, letterSpacing: '0.05em' }}>
                  Attendee Registry
                </span>
                <h3 style={{ fontSize: '1.3rem', marginTop: '0.2rem' }}>{attendeesModalEvent.title}</h3>
              </div>
              <button onClick={() => setAttendeesModalEvent(null)} aria-label="Close modal" style={{ color: 'var(--text-muted)' }}>
                <X size={20} />
              </button>
            </div>

            {attendeesLoading ? (
              <LoadingSpinner message="Retrieving attendee records..." />
            ) : attendeesList.length === 0 ? (
              <p style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '2.5rem 0' }}>
                No attendees registered yet for this event.
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: '420px', overflowY: 'auto' }}>
                {attendeesList.map((a) => (
                  <div key={a.ticketId} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.85rem 1.15rem', background: '#14141b', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>{a.attendeeName}</div>
                      <div style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>{a.attendeeEmail}</div>
                      <div style={{ color: 'var(--accent-secondary)', fontSize: '0.72rem', fontFamily: 'monospace', marginTop: '0.2rem' }}>
                        Ticket: {a.ticketId}
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
