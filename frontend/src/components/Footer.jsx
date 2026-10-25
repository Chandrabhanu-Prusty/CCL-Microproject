import React from 'react';
import { Sparkles, Shield, Cpu, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function Footer() {
  return (
    <footer className="footer">
      <div className="footer-content">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 800, fontSize: '1.05rem', color: 'var(--text-primary)' }}>
          <Sparkles size={18} style={{ color: 'var(--accent-primary)' }} />
          <span>Marque Campus Event Platform</span>
        </div>
        <p style={{ maxWidth: '620px', margin: '0 auto', fontSize: '0.825rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
          Streamlined campus event discovery, capacity-safe free RSVP, FIFO waitlists, and single-use digital QR ticketing. Built with React + Vite frontend and designed for AWS Serverless architecture (API Gateway, Lambda, DynamoDB, S3).
        </p>

        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '1.5rem', fontSize: '0.78rem', color: 'var(--text-muted)', borderTop: '1px solid var(--border-subtle)', paddingTop: '1.25rem', width: '100%', maxWidth: '640px' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <Cpu size={14} style={{ color: 'var(--accent-secondary)' }} />
            <span>CCL Microproject 2026</span>
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <Shield size={14} style={{ color: 'var(--accent-primary)' }} />
            <span>Verified Single-Use Entry</span>
          </span>
          <Link to="/events" style={{ color: 'var(--text-secondary)', textDecoration: 'underline' }}>
            Event Catalog
          </Link>
        </div>
      </div>
    </footer>
  );
}
