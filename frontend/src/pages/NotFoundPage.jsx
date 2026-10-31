import React from 'react';
import { Link } from 'react-router-dom';
import { Compass, ArrowLeft } from 'lucide-react';

export default function NotFoundPage() {
  return (
    <div style={{ textAlign: 'center', padding: '4rem 1.5rem', maxWidth: '460px', margin: '0 auto' }}>
      <div className="empty-icon-circle" style={{ margin: '0 auto 1.25rem', width: '64px', height: '64px' }}>
        <Compass size={32} />
      </div>
      <h1 style={{ fontSize: '2.5rem', marginBottom: '0.25rem', color: 'var(--text-primary)' }}>
        404
      </h1>
      <h2 style={{ fontSize: '1.15rem', marginBottom: '0.75rem', color: 'var(--text-primary)' }}>
        Page Not Found
      </h2>
      <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem', fontSize: '0.875rem', lineHeight: 1.6 }}>
        The campus event pass, check-in resource, or directory link you followed does not exist or has been relocated.
      </p>
      <Link to="/events" className="btn btn-primary btn-sm">
        <ArrowLeft size={14} />
        <span>Return to Discover Events</span>
      </Link>
    </div>
  );
}
