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
  UserCheck 
} from 'lucide-react';

export default function Navbar() {
  const { user, isAuthenticated, role, logout, switchRole } = useAuth();
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

        {/* Navigation Links */}
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

        {/* Right side: Role Switcher & Auth */}
        <div className="nav-actions">
          {isAuthenticated && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(255, 255, 255, 0.05)', padding: '0.25rem 0.5rem', borderRadius: 'var(--radius-full)', border: '1px solid var(--border-subtle)' }}>
              <UserCheck size={14} style={{ color: 'var(--accent-primary)', marginLeft: '0.25rem' }} />
              <select
                value={role}
                onChange={handleRoleChange}
                aria-label="Role Switcher"
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
                }}
              >
                <option value="ATTENDEE" style={{ background: '#111827', color: '#fff' }}>Role: Attendee</option>
                <option value="ORGANIZER" style={{ background: '#111827', color: '#fff' }}>Role: Organizer</option>
                <option value="COORDINATOR" style={{ background: '#111827', color: '#fff' }}>Role: Coordinator</option>
              </select>
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
                  navigate('/events');
                }}
                className="btn btn-sm btn-outline"
                title="Sign out"
              >
                <LogOut size={14} />
              </button>
            </div>
          ) : (
            <Link to="/auth" className="btn btn-sm btn-primary">
              <LogIn size={15} />
              <span>Sign In</span>
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
}
