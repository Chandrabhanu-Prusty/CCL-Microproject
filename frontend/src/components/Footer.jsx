import React from 'react';
import { Sparkles, Shield, Cpu } from 'lucide-react';

export default function Footer() {
  return (
    <footer className="footer">
      <div className="footer-content">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 700, color: 'var(--text-primary)' }}>
          <Sparkles size={16} style={{ color: 'var(--accent-primary)' }} />
          <span>Marque Campus Event Platform</span>
        </div>
        <p style={{ maxWidth: '600px', margin: '0 auto', fontSize: '0.8125rem' }}>
          Responsive event discovery, capacity-safe free RSVP, and single-use digital QR ticketing for campus events. Powered by React + Vite and AWS Serverless architecture (API Gateway, Lambda, DynamoDB, S3).
        </p>
        <div style={{ display: 'flex', gap: '1.5rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <Cpu size={13} />
            CCL Microproject 2026
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <Shield size={13} />
            Secure Single-Use Verification
          </span>
        </div>
      </div>
    </footer>
  );
}
