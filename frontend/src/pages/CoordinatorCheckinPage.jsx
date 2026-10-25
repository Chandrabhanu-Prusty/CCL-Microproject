import React, { useState, useEffect } from 'react';
import { 
  Camera, 
  Search, 
  CheckCircle2, 
  AlertTriangle, 
  XCircle, 
  Clock, 
  User, 
  Mail, 
  ShieldCheck, 
  Sparkles, 
  ArrowRight, 
  Ticket 
} from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import * as eventService from '../services/eventService';
import * as checkinService from '../services/checkinService';
import QrScanner from '../components/QrScanner';
import StatusBadge from '../components/StatusBadge';
import LoadingSpinner from '../components/LoadingSpinner';
import ErrorMessage from '../components/ErrorMessage';

export default function CoordinatorCheckinPage() {
  const { user, isCoordinator, switchRole, isMockMode } = useAuth();
  const [events, setEvents] = useState([]);
  const [selectedEventId, setSelectedEventId] = useState('');
  const [activeTab, setActiveTab] = useState('CAMERA'); // 'CAMERA' | 'MANUAL'
  const [loading, setLoading] = useState(true);
  const [checkingIn, setCheckingIn] = useState(false);

  // Manual lookup state
  const [searchQuery, setSearchQuery] = useState('');
  const [directTicketId, setDirectTicketId] = useState('');
  const [attendees, setAttendees] = useState([]);
  const [attendeesLoading, setAttendeesLoading] = useState(false);

  // Check-in result status
  const [checkInResult, setCheckInResult] = useState(null);

  // Sound feedback helper for venue coordinators
  const playFeedbackSound = (type) => {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      if (type === 'success') {
        osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
        osc.frequency.setValueAtTime(880, ctx.currentTime + 0.1); // A5
        gain.gain.setValueAtTime(0.3, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.3);
      } else {
        osc.frequency.setValueAtTime(220, ctx.currentTime); // A3
        osc.frequency.setValueAtTime(180, ctx.currentTime + 0.12);
        gain.gain.setValueAtTime(0.4, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.35);
      }
    } catch {
      // AudioContext unavailable or blocked by autoplay policy
    }
  };

  // Load events
  useEffect(() => {
    const fetchEvents = async () => {
      try {
        setLoading(true);
        const res = await eventService.getEvents();
        const list = res.events || [];
        setEvents(list);
        if (list.length > 0) {
          setSelectedEventId(list[0].eventId);
        }
      } catch (err) {
        console.error('Failed to load events for check-in:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchEvents();
  }, []);

  // Search attendees when in manual mode
  const searchAttendees = async (eventId, query) => {
    if (!eventId) return;
    try {
      setAttendeesLoading(true);
      const res = await checkinService.getAttendees(eventId, query);
      setAttendees(res.attendees || []);
    } catch (err) {
      console.error('Failed to search attendees:', err);
    } finally {
      setAttendeesLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'MANUAL' && selectedEventId) {
      const timer = setTimeout(() => {
        searchAttendees(selectedEventId, searchQuery);
      }, 200);
      return () => clearTimeout(timer);
    }
  }, [activeTab, selectedEventId, searchQuery]);

  // Execute single-use check-in via API (shared by camera scan & manual lookup)
  const processCheckIn = async (ticketId) => {
    if (!selectedEventId) {
      alert('Please select an active campus event first.');
      return;
    }
    const cleanId = ticketId.trim();
    if (!cleanId) return;

    try {
      setCheckingIn(true);
      setCheckInResult(null);

      // Call API Gateway check-in endpoint
      const result = await checkinService.checkInTicket(selectedEventId, cleanId);

      playFeedbackSound('success');
      setCheckInResult({
        type: 'success',
        message: 'Ticket verified and successfully checked in! Admission approved.',
        details: {
          ticketId: result.ticketId,
          attendeeName: result.attendeeName,
          attendeeEmail: result.attendeeEmail,
          checkedInAt: result.checkedInAt,
        },
      });

      // Refresh attendee list if manual tab is open
      if (activeTab === 'MANUAL') {
        await searchAttendees(selectedEventId, searchQuery);
      }
    } catch (err) {
      console.warn('Check-in error response:', err);
      playFeedbackSound('error');

      if (err.code === 'ALREADY_CHECKED_IN' || err.status === 409) {
        setCheckInResult({
          type: 'warning',
          message: err.message || 'Ticket has ALREADY been admitted. Duplicate check-in rejected!',
          details: { ticketId: cleanId },
        });
      } else {
        setCheckInResult({
          type: 'error',
          message: err.message || 'Invalid or unrecognized ticket ID for this event.',
          details: { ticketId: cleanId },
        });
      }
    } finally {
      setCheckingIn(false);
    }
  };

  const selectedEvent = events.find((e) => e.eventId === selectedEventId);

  return (
    <div style={{ maxWidth: '820px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '1.25rem', marginBottom: '2rem' }}>
        <div>
          <h1 style={{ fontSize: '2.15rem', marginBottom: '0.35rem' }}>Coordinator Venue Check-in</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
            Scan digital QR passes or run manual attendee lookups at the campus event entrance.
          </p>
        </div>

        {isMockMode && !isCoordinator && (
          <button
            onClick={() => switchRole('COORDINATOR')}
            className="btn btn-secondary btn-sm"
            style={{ borderColor: 'rgba(255, 138, 61, 0.4)', color: '#ff9a54' }}
          >
            <Sparkles size={14} />
            <span>Switch to Coordinator Role</span>
          </button>
        )}
      </div>

      {/* Role Notice if not Coordinator or Organizer */}
      {!isCoordinator && (
        <div style={{ marginBottom: '1.75rem', padding: '1rem 1.25rem', borderRadius: 'var(--radius-md)', background: 'rgba(255, 138, 61, 0.09)', border: '1px solid rgba(255, 138, 61, 0.3)', color: '#ffae70', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', fontSize: '0.875rem' }}>
            <Sparkles size={18} style={{ color: 'var(--accent-secondary)', flexShrink: 0 }} />
            <span>
              You are signed in as <strong>{user?.role || 'Attendee'}</strong>.
              {isMockMode
                ? " Click 'Switch to Coordinator Role' to simulate check-in permissions."
                : ' Coordinator or Organizer privileges are required by the backend to check in tickets.'}
            </span>
          </div>
          {isMockMode && (
            <button onClick={() => switchRole('COORDINATOR')} className="btn btn-sm btn-primary" style={{ flexShrink: 0 }}>
              Activate Role
            </button>
          )}
        </div>
      )}

      {/* Event Selection Selector */}
      <div className="card" style={{ marginBottom: '1.5rem', padding: '1.35rem', background: '#191921', borderColor: 'var(--border-subtle)' }}>
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem' }}>
            <Ticket size={16} style={{ color: 'var(--accent-primary)' }} />
            <span>Active Campus Event For Check-in</span>
          </label>
          <select
            value={selectedEventId}
            onChange={(e) => {
              setSelectedEventId(e.target.value);
              setCheckInResult(null);
            }}
            className="form-select"
            style={{ fontSize: '1rem', padding: '0.75rem 1rem', background: '#14141b' }}
          >
            {events.map((e) => (
              <option key={e.eventId} value={e.eventId} style={{ background: '#191921', color: '#fff' }}>
                {e.title} ({e.venue})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Tabs: Camera Scanner vs Manual Lookup */}
      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.5rem' }}>
        <button
          onClick={() => {
            setActiveTab('CAMERA');
            setCheckInResult(null);
          }}
          className={`btn ${activeTab === 'CAMERA' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ flex: 1, padding: '0.85rem' }}
        >
          <Camera size={18} />
          <span>Camera QR Scanner</span>
        </button>

        <button
          onClick={() => {
            setActiveTab('MANUAL');
            setCheckInResult(null);
          }}
          className={`btn ${activeTab === 'MANUAL' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ flex: 1, padding: '0.85rem' }}
        >
          <Search size={18} />
          <span>Manual Attendee Lookup</span>
        </button>
      </div>

      {/* Check-in Verification Feedback Banner */}
      {checkInResult && (
        <div
          style={{
            marginBottom: '1.75rem',
            padding: '1.25rem 1.5rem',
            borderRadius: 'var(--radius-lg)',
            background:
              checkInResult.type === 'success'
                ? 'rgba(16, 185, 129, 0.15)'
                : checkInResult.type === 'warning'
                ? 'rgba(255, 138, 61, 0.15)'
                : 'rgba(239, 68, 68, 0.15)',
            border: `2px solid ${
              checkInResult.type === 'success'
                ? '#10b981'
                : checkInResult.type === 'warning'
                ? '#ff8a3d'
                : '#ef4444'
            }`,
            display: 'flex',
            flexDirection: 'column',
            gap: '0.65rem',
            animation: 'fadeIn 0.2s ease',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            {checkInResult.type === 'success' ? (
              <CheckCircle2 size={24} style={{ color: '#34d399', flexShrink: 0 }} />
            ) : checkInResult.type === 'warning' ? (
              <AlertTriangle size={24} style={{ color: '#ff9a54', flexShrink: 0 }} />
            ) : (
              <XCircle size={24} style={{ color: '#f87171', flexShrink: 0 }} />
            )}
            <h3
              style={{
                fontSize: '1.18rem',
                color:
                  checkInResult.type === 'success'
                    ? '#34d399'
                    : checkInResult.type === 'warning'
                    ? '#ff9a54'
                    : '#f87171',
              }}
            >
              {checkInResult.type === 'success'
                ? 'Check-In Approved'
                : checkInResult.type === 'warning'
                ? 'Duplicate Check-In Detected'
                : 'Ticket Validation Rejected'}
            </h3>
          </div>

          <p style={{ fontSize: '0.95rem', color: '#f7f7fa', marginLeft: '2.5rem' }}>
            {checkInResult.message}
          </p>

          {checkInResult.details?.attendeeName && (
            <div style={{ marginLeft: '2.5rem', marginTop: '0.4rem', fontSize: '0.85rem', display: 'flex', flexWrap: 'wrap', gap: '1.25rem', color: 'var(--text-secondary)' }}>
              <div><strong>Attendee:</strong> {checkInResult.details.attendeeName}</div>
              <div><strong>Ticket:</strong> <code style={{ color: 'var(--accent-secondary)' }}>{checkInResult.details.ticketId}</code></div>
              {checkInResult.details.checkedInAt && (
                <div><strong>Timestamp:</strong> {new Date(checkInResult.details.checkedInAt).toLocaleTimeString()}</div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Active Tab View */}
      {activeTab === 'CAMERA' ? (
        <div>
          {checkingIn && (
            <div style={{ textAlign: 'center', marginBottom: '1rem', color: 'var(--accent-primary)', fontWeight: 700 }}>
              Verifying scanned ticket with backend...
            </div>
          )}
          <QrScanner
            onScanSuccess={(scannedTicketId) => {
              if (!checkingIn) {
                processCheckIn(scannedTicketId);
              }
            }}
            onSwitchToManual={() => setActiveTab('MANUAL')}
          />
        </div>
      ) : (
        /* Manual Attendee & Ticket Lookup */
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Quick Direct Ticket ID Box */}
          <div className="card" style={{ padding: '1.35rem', background: '#191921' }}>
            <h3 style={{ fontSize: '1.05rem', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <ShieldCheck size={18} style={{ color: 'var(--accent-primary)' }} />
              <span>Direct Check-in by Ticket ID</span>
            </h3>
            <div style={{ display: 'flex', gap: '0.65rem' }}>
              <input
                type="text"
                placeholder="Enter or paste ticket reference (e.g. tkt-8f3a9e1b2c4d)..."
                value={directTicketId}
                onChange={(e) => setDirectTicketId(e.target.value)}
                className="form-input"
                style={{ fontFamily: 'monospace' }}
              />
              <button
                onClick={() => processCheckIn(directTicketId)}
                disabled={checkingIn || !directTicketId.trim()}
                className="btn btn-primary"
                style={{ flexShrink: 0 }}
              >
                {checkingIn ? 'Checking...' : 'Check In'}
              </button>
            </div>
          </div>

          {/* Attendee Registry Search Box */}
          <div className="card" style={{ padding: '1.35rem', background: '#191921' }}>
            <h3 style={{ fontSize: '1.05rem', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Search size={18} style={{ color: 'var(--accent-secondary)' }} />
              <span>Lookup Registered Attendees</span>
            </h3>
            <input
              type="text"
              placeholder="Search by attendee name, email address, or ticket ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="form-input"
              style={{ marginBottom: '1rem' }}
            />

            {attendeesLoading ? (
              <LoadingSpinner message="Searching registered attendees..." />
            ) : attendees.length === 0 ? (
              <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem 0' }}>
                No registered attendees match "{searchQuery}".
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: '420px', overflowY: 'auto' }}>
                {attendees.map((a) => (
                  <div
                    key={a.ticketId}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '0.9rem 1.15rem',
                      background: '#14141b',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--border-subtle)',
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>{a.attendeeName}</div>
                      <div style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>{a.attendeeEmail}</div>
                      <div style={{ color: 'var(--accent-secondary)', fontSize: '0.72rem', fontFamily: 'monospace', marginTop: '0.2rem' }}>
                        ID: {a.ticketId}
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <StatusBadge status={a.status} />
                      {a.status !== 'CHECKED_IN' && a.status !== 'CANCELLED' && (
                        <button
                          onClick={() => processCheckIn(a.ticketId)}
                          disabled={checkingIn}
                          className="btn btn-sm btn-success"
                        >
                          Check In
                        </button>
                      )}
                    </div>
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
