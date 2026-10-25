import React from 'react';
import { Sparkles } from 'lucide-react';

export default function EmptyState({ 
  icon: Icon = Sparkles, 
  title = 'No items found', 
  description = 'There are no records matching your query.', 
  actionLabel, 
  onAction 
}) {
  return (
    <div className="empty-state">
      <div className="empty-icon-circle">
        <Icon size={32} />
      </div>
      <h3 style={{ fontSize: '1.25rem', marginBottom: '0.25rem' }}>{title}</h3>
      <p style={{ color: 'var(--text-secondary)', fontSize: '0.9375rem', lineHeight: 1.5 }}>
        {description}
      </p>
      {actionLabel && onAction && (
        <button 
          onClick={onAction}
          className="btn btn-primary"
          style={{ marginTop: '0.75rem' }}
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}
