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
  Ticket,
  UserCheck
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
        osc.frequency.setValueAtTime(587.33, ctx.currentTime);
        osc.frequency.setValueAtTime(880, ctx.currentTime + 0.1);
        gain.gain.setValueAtTime(0.25, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.28);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.28);
      } else {
        osc.frequency.setValueAtTime(220, ctx.currentTime);
        osc.frequency.setValueAtTime(180, ctx.currentTime + 0.12);
        gain.gain.setValueAtTime(0.35, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.35);
      }
    } catch {
      // AudioContext unavailable
    }
  };

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
        message: 'Ticket verified and successfully checked in! Admission approved.',
        details: {
          ticketId: result.ticketId,
          attendeeName: result.attendeeName,
          attendeeEmail: result.attendeeEmail,
          checkedInAt: result.checkedInAt,
        },
      });

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
    <div style={{ maxWidth: '800px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '1rem' }}>
        <div>
          <h2 style={{ fontSize: '1.5rem', marginBottom: '0.25rem' }}>Venue Check-in</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
            Verify attendee entry via camera QR scanner or search the registered guest list.
          </p>
        </div>

        {isMockMode && !isCoordinator && (
          <button
            onClick={() => switchRole('COORDINATOR')}
            className="btn btn-secondary btn-sm"
            style={{ borderColor: 'rgba(240, 182, 90, 0.4)', color: 'var(--status-warning)' }}
          >
            <UserCheck size={14} />
            <span>Switch to Coordinator Persona</span>
          </button>
        )}
      </div>

      {/* Role Notice */}
      {!isCoordinator && (
        <div style={{ padding: '0.85rem 1rem', borderRadius: 'var(--radius-sm)', background: 'var(--status-warning-bg)', border: '1px solid var(--status-warning-border)', color: 'var(--status-warning)', fontSize: '0.8125rem' }}>
          You are signed in as <strong>{user?.role || 'Attendee'}</strong>. Check-in operations require <strong>Coordinator</strong> or <strong>Organizer</strong> permissions.
        </div>
      )}

      {/* Event Selection */}
      <div className="card" style={{ padding: '1rem 1.25rem' }}>
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
            <Ticket size={15} style={{ color: 'var(--accent-pink)' }} />
            <span>Active Campus Event for Check-in</span>
          </label>
          <select
            value={selectedEventId}
            onChange={(e) => {
              setSelectedEventId(e.target.value);
              setCheckInResult(null);
            }}
            className="form-select"
            aria-label="Select event for check-in"
          >
            {events.map((e) => (
              <option key={e.eventId} value={e.eventId} style={{ background: '#14151B', color: '#fff' }}>
                {e.title} — {e.venue || 'Campus Venue'}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Tabs: Camera Scanner vs Manual Lookup */}
      <div style={{ display: 'flex', gap: '0.5rem', background: 'var(--bg-card)', padding: '0.25rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-default)' }}>
        <button
          onClick={() => {
            setActiveTab('CAMERA');
            setCheckInResult(null);
          }}
          className={`btn btn-sm ${activeTab === 'CAMERA' ? 'btn-primary' : 'btn-ghost'}`}
          style={{ flex: 1, padding: '0.5rem' }}
        >
          <Camera size={16} />
          <span>Camera QR Scanner</span>
        </button>

        <button
          onClick={() => {
            setActiveTab('MANUAL');
            setCheckInResult(null);
          }}
          className={`btn btn-sm ${activeTab === 'MANUAL' ? 'btn-primary' : 'btn-ghost'}`}
          style={{ flex: 1, padding: '0.5rem' }}
        >
          <Search size={16} />
          <span>Manual Guest Lookup</span>
        </button>
      </div>

      {/* Validation Result Banner */}
      {checkInResult && (
        <div
          style={{
            padding: '1rem 1.25rem',
            borderRadius: 'var(--radius-sm)',
            background:
              checkInResult.type === 'success'
                ? 'var(--status-success-bg)'
                : checkInResult.type === 'warning'
                ? 'var(--status-warning-bg)'
                : 'var(--status-error-bg)',
            border: `1px solid ${
              checkInResult.type === 'success'
                ? 'var(--status-success-border)'
                : checkInResult.type === 'warning'
                ? 'var(--status-warning-border)'
                : 'var(--status-error-border)'
            }`,
            display: 'flex',
            flexDirection: 'column',
            gap: '0.4rem',
            animation: 'fadeIn 0.15s ease',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            {checkInResult.type === 'success' ? (
              <CheckCircle2 size={22} style={{ color: 'var(--status-success)', flexShrink: 0 }} />
            ) : checkInResult.type === 'warning' ? (
              <AlertTriangle size={22} style={{ color: 'var(--status-warning)', flexShrink: 0 }} />
            ) : (
              <XCircle size={22} style={{ color: 'var(--status-error)', flexShrink: 0 }} />
            )}
            <h3
              style={{
                fontSize: '1rem',
                color:
                  checkInResult.type === 'success'
                    ? 'var(--status-success)'
                    : checkInResult.type === 'warning'
                    ? 'var(--status-warning)'
                    : 'var(--status-error)',
              }}
            >
              {checkInResult.type === 'success'
                ? 'Check-In Approved'
                : checkInResult.type === 'warning'
                ? 'Duplicate Ticket Scanned'
                : 'Ticket Validation Rejected'}
            </h3>
          </div>

          <p style={{ fontSize: '0.875rem', color: 'var(--text-primary)', marginLeft: '2rem' }}>
            {checkInResult.message}
          </p>

          {checkInResult.details?.attendeeName && (
            <div style={{ marginLeft: '2rem', marginTop: '0.35rem', fontSize: '0.8125rem', display: 'flex', flexWrap: 'wrap', gap: '1rem', color: 'var(--text-secondary)' }}>
              <div><strong>Attendee:</strong> {checkInResult.details.attendeeName}</div>
              <div><strong>Ticket Ref:</strong> <code>{checkInResult.details.ticketId}</code></div>
              {checkInResult.details.checkedInAt && (
                <div><strong>Timestamp:</strong> {new Date(checkInResult.details.checkedInAt).toLocaleTimeString()}</div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Tab Panels */}
      {activeTab === 'CAMERA' ? (
        <div>
          {checkingIn && (
            <div style={{ textAlign: 'center', marginBottom: '0.85rem', color: 'var(--accent-pink)', fontSize: '0.875rem', fontWeight: 600 }}>
              Verifying ticket with backend...
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* Quick Ticket ID input */}
          <div className="card" style={{ padding: '1.25rem' }}>
            <h3 style={{ fontSize: '0.9375rem', marginBottom: '0.65rem', display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
              <ShieldCheck size={16} style={{ color: 'var(--accent-pink)' }} />
              Direct Check-in by Ticket Reference
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
            <h3 style={{ fontSize: '0.9375rem', marginBottom: '0.65rem', display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
              <Search size={16} style={{ color: 'var(--accent-orange)' }} />
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
              <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '1.5rem 0', fontSize: '0.875rem' }}>
                No attendees found matching "{searchQuery}".
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '420px', overflowY: 'auto' }}>
                {attendees.map((a) => (
                  <div
                    key={a.ticketId}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '0.75rem 0.85rem',
                      background: '#14151B',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid var(--border-subtle)',
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>{a.attendeeName}</div>
                      <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>{a.attendeeEmail}</div>
                      <div style={{ color: 'var(--text-muted)', fontSize: '0.6875rem', fontFamily: 'monospace', marginTop: '0.15rem' }}>
                        ID: {a.ticketId}
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
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
