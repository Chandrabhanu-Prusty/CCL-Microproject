import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { Sparkles, Mail, Lock, User, ArrowRight, ShieldCheck, Zap } from 'lucide-react';

export default function AuthPage() {
  const [isRegister, setIsRegister] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);

  const { login, register } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const returnUrl = location.state?.from || '/events';

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage(null);
    setLoading(true);

    try {
      if (isRegister) {
        if (!name.trim()) throw new Error('Please enter your full name.');
        await register(name, email, password);
      } else {
        await login(email, password);
      }
      navigate(returnUrl);
    } catch (err) {
      console.error('Authentication error:', err);
      setErrorMessage(err.message || 'Authentication failed. Please verify your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const setDemoCredentials = (role) => {
    if (role === 'ATTENDEE') {
      setEmail('chandrabhanu@example.com');
      setPassword('StrongPassword123!');
      setName('Chandrabhanu Prusty');
    } else if (role === 'ORGANIZER') {
      setEmail('organizer.neilsen@example.com');
      setPassword('StrongPassword123!');
      setName('Neilsen Organizer');
    } else if (role === 'COORDINATOR') {
      setEmail('coordinator.preeti@example.com');
      setPassword('StrongPassword123!');
      setName('Preeti Coordinator');
    }
  };

  return (
    <div style={{ maxWidth: '440px', margin: '2rem auto', padding: '0 1rem' }}>
      <div className="card" style={{ padding: '2rem' }}>
        {/* Brand Header */}
        <div style={{ textAlign: 'center', marginBottom: '1.75rem' }}>
          <div className="brand-icon-wrapper" style={{ margin: '0 auto 1rem', width: '48px', height: '48px' }}>
            <Sparkles size={24} />
          </div>
          <h2 style={{ fontSize: '1.5rem', marginBottom: '0.25rem' }}>
            {isRegister ? 'Create an Account' : 'Welcome to Marque'}
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
            {isRegister ? 'Join campus events and claim your free passes' : 'Sign in to access your tickets and registrations'}
          </p>
        </div>

        {/* Quick Demo Personas */}
        <div style={{ marginBottom: '1.5rem', background: 'rgba(99, 102, 241, 0.08)', border: '1px solid rgba(99, 102, 241, 0.2)', borderRadius: 'var(--radius-md)', padding: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.75rem', fontWeight: 700, color: '#a5b4fc', textTransform: 'uppercase', marginBottom: '0.5rem' }}>
            <Zap size={13} />
            Quick Demo Credentials
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.35rem' }}>
            <button
              type="button"
              onClick={() => setDemoCredentials('ATTENDEE')}
              className="btn btn-sm btn-secondary"
              style={{ fontSize: '0.6875rem', padding: '0.3rem' }}
            >
              Attendee
            </button>
            <button
              type="button"
              onClick={() => setDemoCredentials('ORGANIZER')}
              className="btn btn-sm btn-secondary"
              style={{ fontSize: '0.6875rem', padding: '0.3rem' }}
            >
              Organizer
            </button>
            <button
              type="button"
              onClick={() => setDemoCredentials('COORDINATOR')}
              className="btn btn-sm btn-secondary"
              style={{ fontSize: '0.6875rem', padding: '0.3rem' }}
            >
              Coordinator
            </button>
          </div>
        </div>

        {/* Error Alert */}
        {errorMessage && (
          <div style={{ marginBottom: '1rem', padding: '0.75rem', background: 'rgba(239, 68, 68, 0.12)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: 'var(--radius-md)', color: '#fca5a5', fontSize: '0.8125rem' }}>
            {errorMessage}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit}>
          {isRegister && (
            <div className="form-group">
              <label className="form-label">Full Name</label>
              <div style={{ position: 'relative' }}>
                <User size={18} style={{ position: 'absolute', left: '0.875rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input
                  type="text"
                  placeholder="e.g. Chandrabhanu Prusty"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="form-input"
                  style={{ paddingLeft: '2.5rem' }}
                  required={isRegister}
                />
              </div>
            </div>
          )}

          <div className="form-group">
            <label className="form-label">Campus Email</label>
            <div style={{ position: 'relative' }}>
              <Mail size={18} style={{ position: 'absolute', left: '0.875rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                type="email"
                placeholder="user@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="form-input"
                style={{ paddingLeft: '2.5rem' }}
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Password</label>
            <div style={{ position: 'relative' }}>
              <Lock size={18} style={{ position: 'absolute', left: '0.875rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                type="password"
                placeholder="••••••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="form-input"
                style={{ paddingLeft: '2.5rem' }}
                required
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn btn-primary"
            style={{ width: '100%', marginTop: '0.75rem', height: '44px' }}
          >
            {loading ? 'Authenticating...' : isRegister ? 'Create Account' : 'Sign In'}
            <ArrowRight size={16} />
          </button>
        </form>

        {/* Mode Toggle */}
        <div style={{ marginTop: '1.5rem', textAlign: 'center', borderTop: '1px solid var(--border-subtle)', paddingTop: '1.25rem' }}>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
            {isRegister ? 'Already registered on Marque?' : "Don't have an account yet?"}
            <button
              type="button"
              onClick={() => {
                setIsRegister(!isRegister);
                setErrorMessage(null);
              }}
              style={{ color: 'var(--accent-primary)', fontWeight: 600, marginLeft: '0.35rem' }}
            >
              {isRegister ? 'Sign In' : 'Register Free'}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
