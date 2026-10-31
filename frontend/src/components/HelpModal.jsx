import React from 'react';
import { X, HelpCircle, Ticket, Calendar, ShieldCheck, QrCode } from 'lucide-react';

export default function HelpModal({ isOpen, onClose }) {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose} role="dialog" aria-modal="true" aria-labelledby="help-modal-title">
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '520px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <div style={{ width: '28px', height: '28px', borderRadius: 'var(--radius-xs)', background: 'rgba(240, 79, 139, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent-pink)' }}>
              <HelpCircle size={16} />
            </div>
            <h2 id="help-modal-title" style={{ fontSize: '1.125rem' }}>How Marque Works</h2>
          </div>
          <button onClick={onClose} aria-label="Close help modal" style={{ color: 'var(--text-muted)' }}>
            <X size={18} />
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
          <div style={{ display: 'flex', gap: '0.75rem', background: '#14151B', padding: '0.85rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
            <Ticket size={20} style={{ color: 'var(--status-success)', flexShrink: 0, marginTop: '2px' }} />
            <div>
              <div style={{ fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.2rem' }}>Free RSVP & Capacity Protection</div>
              <div>Events are free to attend. When an event reaches maximum capacity, you enter a fair First-In-First-Out (FIFO) waitlist. If an attendee cancels, the next waitlisted user is automatically promoted.</div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', background: '#14151B', padding: '0.85rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
            <QrCode size={20} style={{ color: 'var(--accent-pink)', flexShrink: 0, marginTop: '2px' }} />
            <div>
              <div style={{ fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.2rem' }}>Digital QR Ticketing</div>
              <div>Confirmed attendees receive a secure digital pass with a unique opaque ticket reference. The QR code contains strictly the ticket ID — never credentials or private information.</div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', background: '#14151B', padding: '0.85rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
            <Calendar size={20} style={{ color: 'var(--accent-orange)', flexShrink: 0, marginTop: '2px' }} />
            <div>
              <div style={{ fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.2rem' }}>Event Organizers & Coordinators</div>
              <div>Organizers publish campus activities and review attendance analytics. Coordinators scan ticket QR codes using the browser camera or perform manual attendee lookups at the door.</div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', background: '#14151B', padding: '0.85rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
            <ShieldCheck size={20} style={{ color: 'var(--status-info)', flexShrink: 0, marginTop: '2px' }} />
            <div>
              <div style={{ fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.2rem' }}>Security & Single-Use Check-in</div>
              <div>Each ticket can only be checked in once. Conditional DynamoDB updates prevent duplicate entries even under concurrent scanning attempts.</div>
            </div>
          </div>
        </div>

        <div style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'flex-end' }}>
          <button onClick={onClose} className="btn btn-primary btn-sm">
            Got it, thanks
          </button>
        </div>
      </div>
    </div>
  );
}

