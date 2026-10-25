import React from 'react';
import { Link } from 'react-router-dom';
import { Compass, ArrowLeft } from 'lucide-react';

export default function NotFoundPage() {
  return (
    <div style={{ textAlign: 'center', padding: '5rem 1.5rem', maxWidth: '520px', margin: '0 auto' }}>
      <div className="empty-icon-circle" style={{ margin: '0 auto 1.5rem', width: '84px', height: '84px' }}>
        <Compass size={42} />
      </div>
      <h1 style={{ fontSize: '3rem', marginBottom: '0.35rem', background: 'var(--accent-gradient)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
        404
      </h1>
      <h2 style={{ fontSize: '1.35rem', marginBottom: '1rem', color: 'var(--text-primary)' }}>
        Campus Page Not Found
      </h2>
      <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem', fontSize: '0.95rem', lineHeight: 1.6 }}>
        The campus event pass, check-in resource, or directory link you followed does not exist or has been relocated.
      </p>
      <Link to="/events" className="btn btn-primary">
        <ArrowLeft size={16} />
        <span>Return to Event Discovery</span>
      </Link>
    </div>
  );
}
