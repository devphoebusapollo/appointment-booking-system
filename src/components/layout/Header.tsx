import React, { useState } from 'react';
import {
  Menu,
  Bell,
  Search,
  ChevronRight,
  Shield,
  UserCheck,
  User as UserIcon,
  LogIn,
  Check,
  Plus,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext.tsx';

interface HeaderProps {
  currentTab: string;
  setMobileOpen: (open: boolean) => void;
  openNewBookingModal?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentTab,
  setMobileOpen,
  openNewBookingModal,
}) => {
  const { user, personas, switchPersona, loginWithGoogle } = useAuth();
  const [showPersonaMenu, setShowPersonaMenu] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const formatTabName = (tab: string) => {
    switch (tab) {
      case 'dashboard':
        return 'Overview';
      case 'appointments':
        return 'Appointments';
      case 'calendar':
        return 'Master Calendar';
      case 'customers':
        return 'Customers';
      case 'services':
        return 'Services';
      case 'staff':
        return 'Staff Team';
      case 'availability':
        return 'Working Schedule';
      case 'analytics':
        return 'Performance';
      case 'settings':
        return 'Settings';
      case 'book':
        return 'Book Appointment';
      case 'my-appointments':
        return 'My Bookings';
      default:
        return 'Workspace';
    }
  };

  return (
    <header className="sticky top-0 z-30 h-16 bg-white border-b border-slate-200/80 px-4 md:px-8 flex items-center justify-between gap-6">
      {/* Zone 1: Mobile menu + Clean contextual breadcrumb */}
      <div className="flex items-center gap-3 min-w-0">
        <button
          onClick={() => setMobileOpen(true)}
          className="p-1.5 -ml-1 text-slate-500 hover:text-slate-900 rounded-md md:hidden"
          aria-label="Open navigation menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2 text-xs truncate">
          <span className="font-semibold text-slate-900 tracking-tight">BookFlow</span>
          <span className="text-slate-300">/</span>
          <span className="text-slate-500 font-medium truncate">{formatTabName(currentTab)}</span>
        </div>
      </div>

      {/* Zone 2: Search input */}
      <div className="relative hidden md:block max-w-xs w-full">
        <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          placeholder="Jump to appointment, client, or service..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 hover:bg-slate-100/70 focus:bg-white border border-slate-200 rounded-md focus:outline-none focus:border-slate-400 transition-colors"
        />
      </div>

      {/* Zone 3: Actions + Persona Switcher */}
      <div className="flex items-center gap-3 shrink-0">
        {/* Quick Role / Persona Switcher */}
        <div className="relative">
          <button
            onClick={() => setShowPersonaMenu(!showPersonaMenu)}
            className="flex items-center gap-2 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:text-slate-900 border border-slate-200 rounded-md bg-white hover:bg-slate-50 transition-colors cursor-pointer"
          >
            <span className="font-semibold truncate max-w-[140px] sm:max-w-none">
              {user ? user.name : 'Select Persona'}
            </span>
            <span className="text-[10px] text-slate-400 font-mono uppercase tracking-wider">
              {user?.role}
            </span>
          </button>

          {showPersonaMenu && (
            <div
              className="absolute right-0 mt-2 w-72 bg-white rounded-lg shadow-lg border border-slate-200 py-1.5 z-50 animate-in fade-in duration-100"
              onClick={() => setShowPersonaMenu(false)}
            >
              <div className="px-3 py-1.5 text-[10px] font-semibold tracking-wider text-slate-400 uppercase">
                Switch Role Persona
              </div>

              <div className="max-h-60 overflow-y-auto py-1 divide-y divide-slate-100">
                {personas.map((p) => {
                  const isCurrent = user?.id === p.id;
                  return (
                    <button
                      key={p.id}
                      onClick={() => switchPersona(p.id)}
                      className={`w-full px-3 py-2 text-left flex items-center justify-between text-xs hover:bg-slate-50 transition-colors cursor-pointer ${
                        isCurrent ? 'bg-slate-50 font-semibold text-slate-900' : 'text-slate-600'
                      }`}
                    >
                      <div className="truncate pr-2">
                        <div className="font-medium text-slate-900 truncate">{p.name}</div>
                        <div className="text-[10px] text-slate-400 font-mono">
                          {p.role} &bull; {p.email}
                        </div>
                      </div>
                      {isCurrent && <Check className="w-3.5 h-3.5 text-slate-900 shrink-0" />}
                    </button>
                  );
                })}
              </div>

              <div className="border-t border-slate-100 pt-1.5 px-3">
                <button
                  onClick={loginWithGoogle}
                  className="w-full py-1.5 px-2 bg-slate-900 hover:bg-slate-800 text-white rounded text-xs font-medium transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <LogIn className="w-3.5 h-3.5" />
                  Sign In with Google
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Global CTA button */}
        {openNewBookingModal && (
          <button
            onClick={openNewBookingModal}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-md shadow-xs transition-colors cursor-pointer whitespace-nowrap"
          >
            <Plus className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">New Appointment</span>
          </button>
        )}
      </div>
    </header>
  );
};
