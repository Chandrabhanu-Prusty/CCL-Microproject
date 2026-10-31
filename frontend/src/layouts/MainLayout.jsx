import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import TopHeader from '../components/TopHeader';
import HelpModal from '../components/HelpModal';

export default function MainLayout() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [helpModalOpen, setHelpModalOpen] = useState(false);

  return (
    <div className="app-shell">
      {/* Sidebar Navigation */}
      <Sidebar 
        isOpen={mobileMenuOpen} 
        onClose={() => setMobileMenuOpen(false)} 
        onOpenHelp={() => setHelpModalOpen(true)}
      />

      {/* Main Content Area */}
      <div className="main-wrapper">
        <TopHeader onToggleMobileMenu={() => setMobileMenuOpen(true)} />

        <main className="main-canvas" id="main-content">
          <div className="workspace-content">
            <Outlet />
          </div>
        </main>
      </div>

      {/* Help & Support Modal */}
      <HelpModal isOpen={helpModalOpen} onClose={() => setHelpModalOpen(false)} />
    </div>
  );
}
