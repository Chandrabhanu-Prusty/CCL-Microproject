import React from 'react';
import { Link } from 'react-router-dom';
import { Compass, ArrowLeft } from 'lucide-react';

export default function NotFoundPage() {
  return (
    <div style={{ textAlign: 'center', padding: '5rem 1.5rem', maxWidth: '480px', margin: '0 auto' }}>
      <div className="empty-icon-circle" style={{ margin: '0 auto 1.5rem', width: '80px', height: '80px' }}>
        <Compass size={40} />
      </div>
      <h1 style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>404</h1>
      <h2 style={{ fontSize: '1.25rem', marginBottom: '1rem', color: 'var(--text-secondary)' }}>Page Not Found</h2>
      <p style={{ color: 'var(--text-muted)', marginBottom: '2rem', fontSize: '0.9375rem' }}>
        The campus event page or resource you are looking for does not exist or has been moved.
      </p>
      <Link to="/events" className="btn btn-primary">
        <ArrowLeft size={16} />
        Back to Event Catalog
      </Link>
    </div>
  );
}
