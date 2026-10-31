import React from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { 
  Sparkles, 
  Calendar, 
  Ticket, 
  LayoutDashboard, 
  QrCode, 
  LogIn, 
  LogOut, 
  UserCheck,
  UserPlus
} from 'lucide-react';

export default function Navbar() {
  const { user, isAuthenticated, role, logout, switchRole, isMockMode } = useAuth();
  const navigate = useNavigate();

  const handleRoleChange = (e) => {
    switchRole(e.target.value);
  };

  return (
    <nav className="navbar">
      <div className="navbar-inner">
        {/* Brand */}
        <Link to="/" className="brand-link">
          <div className="brand-icon-wrapper">
            <Sparkles size={20} />
          </div>
          <span>Marque</span>
        </Link>

        {/* Navigation Links — Only visible when authenticated */}
        {isAuthenticated && (
          <div className="nav-links">
            <NavLink to="/events" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
              <Calendar size={16} />
              <span>Events</span>
            </NavLink>

            <NavLink to="/my-registrations" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
              <Ticket size={16} />
              <span>My Registrations</span>
            </NavLink>

            <NavLink to="/organizer" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
              <LayoutDashboard size={16} />
              <span>Organizer</span>
            </NavLink>

            <NavLink to="/checkin" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
              <QrCode size={16} />
              <span>Check-in</span>
            </NavLink>
          </div>
        )}

        {/* Right side: Role Switcher & Auth */}
        <div className="nav-actions">
          {isAuthenticated && isMockMode && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.45rem',
                background: '#191921',
                padding: '0.3rem 0.65rem',
                borderRadius: 'var(--radius-full)',
                border: '1px solid var(--border-subtle)',
              }}
            >
              <UserCheck size={14} style={{ color: 'var(--accent-primary)', marginLeft: '0.15rem' }} />
              <select
                value={role}
                onChange={handleRoleChange}
                aria-label="Demo Role Switcher"
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-primary)',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  cursor: 'pointer',
                  paddingRight: '0.25rem',
                  outline: 'none',
                }}
              >
                <option value="ATTENDEE" style={{ background: '#191921', color: '#fff' }}>Role: Attendee</option>
                <option value="ORGANIZER" style={{ background: '#191921', color: '#fff' }}>Role: Organizer</option>
                <option value="COORDINATOR" style={{ background: '#191921', color: '#fff' }}>Role: Coordinator</option>
              </select>
            </div>
          )}

          {isAuthenticated && !isMockMode && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                background: '#191921',
                padding: '0.3rem 0.75rem',
                borderRadius: 'var(--radius-full)',
                border: '1px solid var(--border-subtle)',
              }}
            >
              <UserCheck size={14} style={{ color: 'var(--accent-primary)' }} />
              <span
                style={{
                  fontSize: '0.72rem',
                  fontWeight: 800,
                  color: 'var(--text-primary)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                }}
              >
                {role}
              </span>
            </div>
          )}

          {isAuthenticated ? (
            <div className="user-menu">
              <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                {user?.name?.split(' ')[0] || 'User'}
              </span>
              <button
                onClick={() => {
                  logout();
                  navigate('/auth');
                }}
                className="btn btn-sm btn-outline"
                title="Sign out"
                style={{ padding: '0.4rem 0.6rem' }}
              >
                <LogOut size={14} />
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Link to="/auth" className="btn btn-sm btn-secondary">
                <LogIn size={14} />
                <span>Sign In</span>
              </Link>
              <Link to="/auth" state={{ mode: 'register' }} className="btn btn-sm btn-primary">
                <UserPlus size={14} />
                <span>Register</span>
              </Link>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}
