import React from 'react';

export default function LoadingSpinner({ message = 'Loading details...' }) {
  return (
    <div className="loading-wrapper">
      <div className="spinner" />
      <p style={{ fontSize: '0.9375rem', fontWeight: 500 }}>{message}</p>
    </div>
  );
}
