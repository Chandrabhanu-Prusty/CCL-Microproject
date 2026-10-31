import React from 'react';
import { useLocation, Link } from 'react-router-dom';
import { Menu, Plus, User, LogIn } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';

export default function TopHeader({ onToggleMobileMenu }) {
  const location = useLocation();
  const { user, isAuthenticated, role, isOrganizer } = useAuth();

  const getPageInfo = () => {
    const path = location.pathname;
    if (path === '/events' || path === '/') {
      return { title: 'Discover Events', subtitle: 'Explore campus workshops, hackathons, and activities' };
    }
    if (path.startsWith('/events/')) {
      return { title: 'Event Details', subtitle: 'View event information and reserve your seat' };
    }
    if (path === '/organizer') {
      return { title: 'Events', subtitle: 'Manage campus events, capacities, and attendees' };
    }
    if (path === '/my-registrations') {
      return { title: 'My Registrations', subtitle: 'Track your confirmed passes and waitlist positions' };
    }
    if (path === '/checkin') {
      return { title: 'Venue Check-in', subtitle: 'Scan QR tickets and verify attendee admissions' };
    }
    if (path.startsWith('/tickets/')) {
      return { title: 'Digital Pass', subtitle: 'Official verified single-use ticket' };
    }
    if (path === '/auth') {
      return { title: 'Account Access', subtitle: 'Sign in to access your registrations' };
    }
    return { title: 'Marque Platform', subtitle: 'Campus Event Management' };
  };

  const { title } = getPageInfo();
  const isOrganizerPage = location.pathname === '/organizer';

  const handleNewEventClick = () => {
    window.dispatchEvent(new CustomEvent('marque:open-create-event'));
  };

  return (
    <header className="top-header">
      <div className="header-left">
        <button 
          onClick={onToggleMobileMenu} 
          className="mobile-menu-btn" 
          aria-label="Open navigation menu"
        >
          <Menu size={18} />
        </button>
        <div>
          <h1 className="header-page-title">{title}</h1>
        </div>
      </div>

      <div className="header-actions">
        {/* Contextual Action: "+ New Event" button on Organizer dashboard */}
        {isOrganizerPage && isOrganizer && (
          <button 
            onClick={handleNewEventClick}
            className="btn btn-primary btn-sm"
          >
            <Plus size={15} />
            <span>New Event</span>
          </button>
        )}

        {/* User state indicator */}
        {isAuthenticated ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <span className="category-pill" style={{ color: 'var(--text-primary)', border: '1px solid var(--border-default)' }}>
              {role}
            </span>
            <div className="user-avatar-circle" title={user?.name || user?.email}>
              <User size={15} />
            </div>
          </div>
        ) : (
          <Link to="/auth" className="btn btn-secondary btn-sm">
            <LogIn size={14} />
            <span>Sign In</span>
          </Link>
        )}
      </div>
    </header>
  );
}

