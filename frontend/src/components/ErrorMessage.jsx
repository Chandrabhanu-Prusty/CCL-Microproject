import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

export default function ErrorMessage({ 
  title = 'Something went wrong', 
  message = 'An unexpected error occurred while communicating with the service.', 
  onRetry 
}) {
  return (
    <div className="error-banner">
      <AlertTriangle size={22} style={{ flexShrink: 0, marginTop: '2px' }} />
      <div style={{ flex: 1 }}>
        <h4 style={{ fontSize: '0.9375rem', fontWeight: 600, color: '#fca5a5', marginBottom: '0.25rem' }}>
          {title}
        </h4>
        <p style={{ fontSize: '0.875rem', color: '#fecaca', lineHeight: 1.4 }}>
          {message}
        </p>
        {onRetry && (
          <button 
            onClick={onRetry}
            className="btn btn-sm btn-outline"
            style={{ marginTop: '0.75rem', borderColor: 'rgba(239,68,68,0.5)', color: '#fca5a5' }}
          >
            <RefreshCw size={13} />
            Try Again
          </button>
        )}
      </div>
    </div>
  );
}
