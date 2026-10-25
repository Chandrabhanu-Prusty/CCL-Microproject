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
  const { user, isCoordinator, switchRole } = useAuth();
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
  const [checkInResult, setCheckInResult] = useState(null); // { type: 'success' | 'warning' | 'error', message: '', details: {} }

  // Sound feedback helper
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
      // AudioContext unavailable or blocked
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

  // Execute single-use check-in via API
  const processCheckIn = async (ticketId) => {
    if (!selectedEventId) {
      alert('Please select an event first.');
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
        message: 'Ticket successfully verified and checked in!',
        details: {
          ticketId: result.ticketId,
          attendeeName: result.attendeeName,
          attendeeEmail: result.attendeeEmail,
          checkedInAt: result.checkedInAt,
        },
      });

      // Refresh manual list if open
      if (activeTab === 'MANUAL') {
        await searchAttendees(selectedEventId, searchQuery);
      }
    } catch (err) {
      console.warn('Check-in error response:', err);
      playFeedbackSound('error');

      if (err.code === 'ALREADY_CHECKED_IN' || err.status === 409) {
        setCheckInResult({
          type: 'warning',
          message: err.message || 'Ticket has ALREADY been checked in. Do not admit twice!',
          details: { ticketId: cleanId },
        });
      } else {
        setCheckInResult({
          type: 'error',
          message: err.message || 'Invalid or unrecognized ticket reference.',
          details: { ticketId: cleanId },
        });
      }
    } finally {
      setCheckingIn(false);
    }
  };

  const selectedEvent = events.find((e) => e.eventId === selectedEventId);

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', marginBottom: '2rem' }}>
        <div>
          <h1 style={{ fontSize: '2rem', marginBottom: '0.25rem' }}>Coordinator Venue Check-in</h1>
          <p style={{ color: 'var(--text-secondary)' }}>
            Scan digital QR tickets or perform manual attendee lookups at the campus venue entrance.
          </p>
        </div>

        {!isCoordinator && (
          <button
            onClick={() => switchRole('COORDINATOR')}
            className="btn btn-secondary btn-sm"
            style={{ borderColor: 'rgba(59, 130, 246, 0.4)', color: '#60a5fa' }}
          >
            <Sparkles size={14} />
            Switch to Coordinator Role
          </button>
        )}
      </div>

      {/* Event Selection Selector */}
      <div className="card" style={{ marginBottom: '1.5rem', padding: '1.25rem' }}>
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Ticket size={16} style={{ color: 'var(--accent-primary)' }} />
            Active Campus Event For Check-in
          </label>
          <select
            value={selectedEventId}
            onChange={(e) => {
              setSelectedEventId(e.target.value);
              setCheckInResult(null);
            }}
            className="form-select"
            style={{ fontSize: '1rem', padding: '0.75rem 1rem' }}
          >
            {events.map((e) => (
              <option key={e.eventId} value={e.eventId} style={{ background: '#111827', color: '#fff' }}>
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
          style={{ flex: 1, padding: '0.75rem' }}
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
          style={{ flex: 1, padding: '0.75rem' }}
        >
          <Search size={18} />
          <span>Manual Attendee Lookup</span>
        </button>
      </div>

      {/* Check-in Verification Feedback Banner */}
      {checkInResult && (
        <div
          style={{
            marginBottom: '1.5rem',
            padding: '1.25rem',
            borderRadius: 'var(--radius-lg)',
            background:
              checkInResult.type === 'success'
                ? 'rgba(16, 185, 129, 0.18)'
                : checkInResult.type === 'warning'
                ? 'rgba(245, 158, 11, 0.18)'
                : 'rgba(239, 68, 68, 0.18)',
            border: `2px solid ${
              checkInResult.type === 'success'
                ? '#10b981'
                : checkInResult.type === 'warning'
                ? '#f59e0b'
                : '#ef4444'
            }`,
            display: 'flex',
            flexDirection: 'column',
            gap: '0.5rem',
            animation: 'fadeIn 0.2s ease',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            {checkInResult.type === 'success' ? (
              <CheckCircle2 size={24} style={{ color: '#34d399', flexShrink: 0 }} />
            ) : checkInResult.type === 'warning' ? (
              <AlertTriangle size={24} style={{ color: '#fbbf24', flexShrink: 0 }} />
            ) : (
              <XCircle size={24} style={{ color: '#f87171', flexShrink: 0 }} />
            )}
            <h3
              style={{
                fontSize: '1.125rem',
                color:
                  checkInResult.type === 'success'
                    ? '#34d399'
                    : checkInResult.type === 'warning'
                    ? '#fbbf24'
                    : '#f87171',
              }}
            >
              {checkInResult.type === 'success'
                ? 'Check-In Approved'
                : checkInResult.type === 'warning'
                ? 'Duplicate Check-In Detected'
                : 'Validation Rejected'}
            </h3>
          </div>

          <p style={{ fontSize: '0.9375rem', color: '#f8fafc', marginLeft: '2.25rem' }}>
            {checkInResult.message}
          </p>

          {checkInResult.details?.attendeeName && (
            <div style={{ marginLeft: '2.25rem', marginTop: '0.5rem', fontSize: '0.875rem', display: 'flex', flexWrap: 'wrap', gap: '1rem', color: 'var(--text-secondary)' }}>
              <div><strong>Attendee:</strong> {checkInResult.details.attendeeName}</div>
              <div><strong>Ticket:</strong> <code>{checkInResult.details.ticketId}</code></div>
              {checkInResult.details.checkedInAt && (
                <div><strong>Timestamp:</strong> {new Date(checkInResult.details.checkedInAt).toLocaleTimeString()}</div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Content depending on Active Tab */}
      {activeTab === 'CAMERA' ? (
        <div>
          {checkingIn && (
            <div style={{ textAlign: 'center', marginBottom: '1rem', color: 'var(--accent-primary)', fontWeight: 600 }}>
              Verifying scanned ticket with backend...
            </div>
          )}
          {/* QR Scanner Component with camera stream cleanup & manual fallback */}
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
          {/* Direct Ticket ID verification box */}
          <div className="card" style={{ padding: '1.25rem' }}>
            <h3 style={{ fontSize: '1rem', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <ShieldCheck size={18} style={{ color: 'var(--accent-primary)' }} />
              Quick Check-in by Ticket ID
            </h3>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
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

          {/* Attendee search box */}
          <div className="card" style={{ padding: '1.25rem' }}>
            <h3 style={{ fontSize: '1rem', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Search size={18} style={{ color: 'var(--accent-secondary)' }} />
              Lookup Registered Attendees
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
              <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '1.5rem 0' }}>
                No attendees found matching "{searchQuery}".
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
                      padding: '0.875rem 1rem',
                      background: 'rgba(15, 23, 42, 0.7)',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--border-subtle)',
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '0.9375rem' }}>{a.attendeeName}</div>
                      <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>{a.attendeeEmail}</div>
                      <div style={{ color: 'var(--text-muted)', fontSize: '0.6875rem', fontFamily: 'monospace', marginTop: '0.2rem' }}>
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
