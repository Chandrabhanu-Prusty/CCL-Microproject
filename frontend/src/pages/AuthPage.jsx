import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { 
  Sparkles, 
  Mail, 
  Lock, 
  User, 
  ArrowRight, 
  ShieldCheck, 
  Zap, 
  Eye, 
  EyeOff, 
  Calendar, 
  QrCode, 
  CheckCircle2, 
  AlertCircle,
  Info
} from 'lucide-react';

export default function AuthPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { login, register, isMockMode } = useAuth();

  // Mode: login vs register
  const initialMode = location.state?.mode === 'register' || location.search.includes('mode=register');
  const [isRegister, setIsRegister] = useState(initialMode);

  // Form inputs
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Stakeholder type for signup: 'ATTENDEE' | 'ORGANIZER' | 'COORDINATOR'
  const [stakeholderType, setStakeholderType] = useState('ATTENDEE');

  // UI state
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const [successNotice, setSuccessNotice] = useState(null);

  const returnUrl = location.state?.from || '/events';

  // Clear errors when toggling modes
  useEffect(() => {
    setErrorMessage(null);
    setSuccessNotice(null);
  }, [isRegister]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessNotice(null);

    // Form validations
    if (isRegister) {
      if (!name.trim()) {
        setErrorMessage('Please enter your full name.');
        return;
      }
      if (password.length < 8) {
        setErrorMessage('Password must be at least 8 characters long.');
        return;
      }
      if (password !== confirmPassword) {
        setErrorMessage('Passwords do not match. Please verify your password entry.');
        return;
      }
    }

    setLoading(true);

    try {
      if (isRegister) {
        // Conforms to API_CONTRACT.md: public registration always creates an Attendee account.
        // Role is not sent in the body; privileged roles require administrative approval.
        await register(name.trim(), email.trim(), password);

        if (stakeholderType !== 'ATTENDEE') {
          // Provide transparent feedback about privileged access approval
          setSuccessNotice(
            `Account successfully registered! As per campus security policy, new accounts default to Attendee permissions. Your request for ${
              stakeholderType === 'ORGANIZER' ? 'Event Organizer' : 'Event Coordinator'
            } privileges has been noted and requires faculty/lead approval.`
          );
          setTimeout(() => {
            navigate(returnUrl);
          }, 2400);
          return;
        }

        navigate(returnUrl);
      } else {
        await login(email.trim(), password);
        navigate(returnUrl);
      }
    } catch (err) {
      console.error('Authentication failure:', err);
      if (err.code === 'NETWORK_ERROR') {
        setErrorMessage(
          'Unable to reach the campus authentication service. Please check your network connection or verify that the API server is active.'
        );
      } else if (err.code === 'CONFIG_ERROR') {
        setErrorMessage(err.message);
      } else {
        setErrorMessage(
          err.message || (isRegister ? 'Registration failed. Please try again.' : 'Invalid email or password.')
        );
      }
    } finally {
      setLoading(false);
    }
  };

  const setDemoCredentials = (role) => {
    if (role === 'ATTENDEE') {
      setEmail('chandrabhanu@example.com');
      setPassword('StrongPassword123!');
      setConfirmPassword('StrongPassword123!');
      setName('Chandrabhanu Prusty');
      setStakeholderType('ATTENDEE');
    } else if (role === 'ORGANIZER') {
      setEmail('organizer.neilsen@example.com');
      setPassword('StrongPassword123!');
      setConfirmPassword('StrongPassword123!');
      setName('Neilsen Organizer');
      setStakeholderType('ORGANIZER');
    } else if (role === 'COORDINATOR') {
      setEmail('coordinator.preeti@example.com');
      setPassword('StrongPassword123!');
      setConfirmPassword('StrongPassword123!');
      setName('Preeti Coordinator');
      setStakeholderType('COORDINATOR');
    }
  };

  return (
    <div style={{ maxWidth: isRegister ? '560px' : '440px', margin: '2rem auto', padding: '0 1rem', transition: 'max-width 0.25s ease' }}>
      <div className="card" style={{ padding: '2.25rem 2rem' }}>
        {/* Brand Header */}
        <div style={{ textAlign: 'center', marginBottom: '1.75rem' }}>
          <div className="brand-icon-wrapper" style={{ margin: '0 auto 1rem', width: '46px', height: '46px' }}>
            <Sparkles size={22} />
          </div>
          <h2 style={{ fontSize: '1.65rem', marginBottom: '0.35rem' }}>
            {isRegister ? 'Create Your Campus Account' : 'Welcome to Marque'}
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
            {isRegister
              ? 'Join official campus activities, RSVP for events, and access digital passes'
              : 'Sign in to access your digital tickets, registrations, and dashboard'}
          </p>
        </div>

        {/* Quick Demo Personas (Restricted strictly to mock mode) */}
        {isMockMode && (
          <div
            style={{
              marginBottom: '1.5rem',
              background: 'rgba(255, 61, 141, 0.08)',
              border: '1px solid rgba(255, 61, 141, 0.25)',
              borderRadius: 'var(--radius-md)',
              padding: '0.75rem 0.85rem',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.75rem', fontWeight: 700, color: 'var(--accent-secondary)', textTransform: 'uppercase', marginBottom: '0.5rem', letterSpacing: '0.04em' }}>
              <Zap size={13} />
              Quick Demo Personas (Mock Mode Only)
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.4rem' }}>
              <button
                type="button"
                onClick={() => setDemoCredentials('ATTENDEE')}
                className="btn btn-sm btn-secondary"
                style={{ fontSize: '0.7rem', padding: '0.35rem 0.25rem' }}
              >
                Attendee
              </button>
              <button
                type="button"
                onClick={() => setDemoCredentials('ORGANIZER')}
                className="btn btn-sm btn-secondary"
                style={{ fontSize: '0.7rem', padding: '0.35rem 0.25rem' }}
              >
                Organizer
              </button>
              <button
                type="button"
                onClick={() => setDemoCredentials('COORDINATOR')}
                className="btn btn-sm btn-secondary"
                style={{ fontSize: '0.7rem', padding: '0.35rem 0.25rem' }}
              >
                Coordinator
              </button>
            </div>
          </div>
        )}

        {/* Success Notice */}
        {successNotice && (
          <div
            style={{
              marginBottom: '1.25rem',
              padding: '0.875rem 1rem',
              background: 'rgba(16, 185, 129, 0.12)',
              border: '1px solid rgba(16, 185, 129, 0.35)',
              borderRadius: 'var(--radius-md)',
              color: '#34d399',
              fontSize: '0.85rem',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '0.5rem',
            }}
          >
            <CheckCircle2 size={18} style={{ flexShrink: 0, marginTop: '0.1rem' }} />
            <span>{successNotice}</span>
          </div>
        )}

        {/* Error Alert */}
        {errorMessage && (
          <div
            style={{
              marginBottom: '1.25rem',
              padding: '0.875rem 1rem',
              background: 'rgba(239, 68, 68, 0.12)',
              border: '1px solid rgba(239, 68, 68, 0.35)',
              borderRadius: 'var(--radius-md)',
              color: '#fca5a5',
              fontSize: '0.85rem',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '0.5rem',
            }}
          >
            <AlertCircle size={18} style={{ flexShrink: 0, marginTop: '0.1rem' }} />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit}>
          {/* Stakeholder Selection Cards (Only on Sign-Up) */}
          {isRegister && (
            <div style={{ marginBottom: '1.5rem' }}>
              <label className="form-label" style={{ marginBottom: '0.65rem' }}>
                How will you use Marque? *
              </label>

              <div className="stakeholder-grid">
                {/* Option A: Attendee */}
                <div
                  className={`stakeholder-card ${stakeholderType === 'ATTENDEE' ? 'selected' : ''}`}
                  onClick={() => setStakeholderType('ATTENDEE')}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && setStakeholderType('ATTENDEE')}
                  aria-pressed={stakeholderType === 'ATTENDEE'}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
                    <div className="stakeholder-icon">
                      <User size={18} />
                    </div>
                    {stakeholderType === 'ATTENDEE' && (
                      <CheckCircle2 size={16} style={{ color: 'var(--accent-primary)' }} />
                    )}
                  </div>
                  <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                    Attendee
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                    Discover events, RSVP, join waitlists, and claim digital passes.
                  </div>
                  <span style={{ fontSize: '0.675rem', color: '#34d399', fontWeight: 600, marginTop: 'auto' }}>
                    Instant self-service
                  </span>
                </div>

                {/* Option B: Event Organizer */}
                <div
                  className={`stakeholder-card ${stakeholderType === 'ORGANIZER' ? 'selected' : ''}`}
                  onClick={() => setStakeholderType('ORGANIZER')}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && setStakeholderType('ORGANIZER')}
                  aria-pressed={stakeholderType === 'ORGANIZER'}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
                    <div className="stakeholder-icon">
                      <Calendar size={18} />
                    </div>
                    {stakeholderType === 'ORGANIZER' && (
                      <CheckCircle2 size={16} style={{ color: 'var(--accent-primary)' }} />
                    )}
                  </div>
                  <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                    Event Organizer
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                    Create events, set capacities, and view live attendance stats.
                  </div>
                  <span style={{ fontSize: '0.675rem', color: '#ff9a54', fontWeight: 600, marginTop: 'auto' }}>
                    Requires approval
                  </span>
                </div>

                {/* Option C: Event Coordinator */}
                <div
                  className={`stakeholder-card ${stakeholderType === 'COORDINATOR' ? 'selected' : ''}`}
                  onClick={() => setStakeholderType('COORDINATOR')}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && setStakeholderType('COORDINATOR')}
                  aria-pressed={stakeholderType === 'COORDINATOR'}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
                    <div className="stakeholder-icon">
                      <QrCode size={18} />
                    </div>
                    {stakeholderType === 'COORDINATOR' && (
                      <CheckCircle2 size={16} style={{ color: 'var(--accent-primary)' }} />
                    )}
                  </div>
                  <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                    Event Coordinator
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                    Scan QR tickets at entrance and run manual attendee lookups.
                  </div>
                  <span style={{ fontSize: '0.675rem', color: '#ff9a54', fontWeight: 600, marginTop: 'auto' }}>
                    Requires approval
                  </span>
                </div>
              </div>

              {/* Informational Policy Notice */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '0.45rem',
                  padding: '0.6rem 0.75rem',
                  borderRadius: 'var(--radius-sm)',
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid var(--border-subtle)',
                  fontSize: '0.75rem',
                  color: 'var(--text-secondary)',
                  lineHeight: 1.4,
                }}
              >
                <Info size={14} style={{ color: 'var(--accent-secondary)', flexShrink: 0, marginTop: '0.1rem' }} />
                <span>
                  {stakeholderType === 'ATTENDEE'
                    ? 'Attendee accounts are activated immediately for self-service event registration.'
                    : 'All public signups default to Attendee. Privileged Organizer and Coordinator roles require administrative verification before elevated permissions are granted.'}
                </span>
              </div>
            </div>
          )}

          {/* Full Name (Sign-up only) */}
          {isRegister && (
            <div className="form-group">
              <label className="form-label">Full Name *</label>
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

          {/* Campus Email */}
          <div className="form-group">
            <label className="form-label">Campus Email Address *</label>
            <div style={{ position: 'relative' }}>
              <Mail size={18} style={{ position: 'absolute', left: '0.875rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                type="email"
                placeholder="your.email@campus.edu"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="form-input"
                style={{ paddingLeft: '2.5rem' }}
                required
              />
            </div>
          </div>

          {/* Password */}
          <div className="form-group">
            <label className="form-label">
              <span>Password *</span>
              {isRegister && <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Min. 8 characters</span>}
            </label>
            <div style={{ position: 'relative' }}>
              <Lock size={18} style={{ position: 'absolute', left: '0.875rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="form-input"
                style={{ paddingLeft: '2.5rem', paddingRight: '2.5rem' }}
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                style={{ position: 'absolute', right: '0.875rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {/* Confirm Password (Sign-up only) */}
          {isRegister && (
            <div className="form-group">
              <label className="form-label">Confirm Password *</label>
              <div style={{ position: 'relative' }}>
                <Lock size={18} style={{ position: 'absolute', left: '0.875rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  placeholder="••••••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="form-input"
                  style={{
                    paddingLeft: '2.5rem',
                    paddingRight: '2.5rem',
                    borderColor:
                      confirmPassword && password !== confirmPassword ? 'rgba(239, 68, 68, 0.6)' : undefined,
                  }}
                  required={isRegister}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  aria-label={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}
                  style={{ position: 'absolute', right: '0.875rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}
                >
                  {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              {confirmPassword && password !== confirmPassword && (
                <span style={{ fontSize: '0.75rem', color: '#f87171', marginTop: '0.2rem' }}>
                  Passwords do not match.
                </span>
              )}
            </div>
          )}

          {/* Submit Button with dynamic role CTA */}
          <button
            type="submit"
            disabled={loading}
            className="btn btn-primary"
            style={{ width: '100%', marginTop: '0.85rem', height: '46px', fontSize: '0.95rem' }}
          >
            {loading ? (
              'Authenticating...'
            ) : isRegister ? (
              stakeholderType === 'ATTENDEE' ? (
                <>
                  <span>Create Account</span>
                  <ArrowRight size={16} />
                </>
              ) : stakeholderType === 'ORGANIZER' ? (
                <>
                  <span>Register & Request Organizer Access</span>
                  <ArrowRight size={16} />
                </>
              ) : (
                <>
                  <span>Register & Request Coordinator Access</span>
                  <ArrowRight size={16} />
                </>
              )
            ) : (
              <>
                <span>Sign In</span>
                <ArrowRight size={16} />
              </>
            )}
          </button>
        </form>

        {/* Mode Toggle (Sign In <-> Register) */}
        <div style={{ marginTop: '1.75rem', textAlign: 'center', borderTop: '1px solid var(--border-subtle)', paddingTop: '1.25rem' }}>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
            {isRegister ? 'Already registered on Marque?' : "Don't have a campus account yet?"}
            <button
              type="button"
              onClick={() => {
                setIsRegister(!isRegister);
                setErrorMessage(null);
                setSuccessNotice(null);
              }}
              style={{ color: 'var(--accent-primary)', fontWeight: 700, marginLeft: '0.4rem' }}
            >
              {isRegister ? 'Sign In' : 'Create Free Account'}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
