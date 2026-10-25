import React from 'react';
import { Users } from 'lucide-react';

export default function CapacityBar({ confirmed = 0, capacity = 0, showDetails = true }) {
  const cap = Number(capacity) || 1;
  const conf = Number(confirmed) || 0;
  const percentage = Math.min(Math.round((conf / cap) * 100), 100);
  const remaining = Math.max(cap - conf, 0);

  let barClass = 'capacity-safe';
  if (percentage >= 100) {
    barClass = 'capacity-full';
  } else if (percentage >= 80) {
    barClass = 'capacity-warning';
  }

  return (
    <div className="capacity-container">
      {showDetails && (
        <div className="capacity-header">
          <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <Users size={14} />
            {conf} / {cap} Confirmed
          </span>
          <span style={{ fontSize: '0.75rem', color: percentage >= 100 ? '#f87171' : 'var(--text-secondary)' }}>
            {remaining === 0 ? 'Waitlist Active' : `${remaining} spots remaining`}
          </span>
        </div>
      )}
      <div className="capacity-bar-track" role="progressbar" aria-valuenow={conf} aria-valuemin={0} aria-valuemax={cap}>
        <div 
          className={`capacity-bar-fill ${barClass}`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}
