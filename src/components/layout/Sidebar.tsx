import React from 'react';
import {
  CalendarDays,
  LayoutDashboard,
  CalendarCheck2,
  Calendar as CalendarIcon,
  Users,
  Briefcase,
  UserCog,
  Clock,
  BarChart3,
  Settings,
  LogOut,
  ChevronLeft,
  ChevronRight,
  BookmarkCheck,
  PlusCircle,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext.tsx';

interface SidebarProps {
  currentTab: string;
  setCurrentTab: (tab: string) => void;
  collapsed: boolean;
  setCollapsed: (collapsed: boolean) => void;
  mobileOpen: boolean;
  setMobileOpen: (open: boolean) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  setCurrentTab,
  collapsed,
  setCollapsed,
  mobileOpen,
  setMobileOpen,
}) => {
  const { user, logout } = useAuth();
  const role = user?.role || 'CUSTOMER';

  const handleNav = (tabId: string) => {
    setCurrentTab(tabId);
    if (mobileOpen) setMobileOpen(false);
  };

  const navItemClass = (id: string) => `
    flex items-center gap-2.5 px-3 py-2 rounded-md text-xs font-medium transition-colors cursor-pointer select-none
    ${
      currentTab === id
        ? 'bg-slate-100 text-slate-900 font-semibold'
        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
    }
  `;

  return (
    <>
      {/* Mobile backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/30 backdrop-blur-xs md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <aside
        className={`fixed top-0 bottom-0 left-0 z-40 bg-white border-r border-slate-200/80 flex flex-col transition-all duration-150 ease-in-out
          ${collapsed ? 'w-[68px]' : 'w-[240px]'}
          ${mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
        `}
      >
        {/* Header Branding */}
        <div className="h-16 px-4 flex items-center justify-between border-b border-slate-200/80 shrink-0">
          <div
            className="flex items-center gap-2.5 overflow-hidden cursor-pointer"
            onClick={() => handleNav(role === 'CUSTOMER' ? 'book' : 'dashboard')}
          >
            <div className="w-8 h-8 rounded-md bg-slate-900 flex items-center justify-center text-white shrink-0">
              <CalendarDays className="w-4 h-4" />
            </div>
            {!collapsed && (
              <div className="flex flex-col truncate">
                <span className="font-bold text-slate-900 tracking-tight text-sm leading-none">
                  BookFlow
                </span>
                <span className="text-[10px] text-slate-400 font-medium tracking-wide mt-1">
                  Studio Atelier
                </span>
              </div>
            )}
          </div>

          <button
            onClick={() => setCollapsed(!collapsed)}
            className="hidden md:flex items-center justify-center w-6 h-6 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronLeft className="w-3.5 h-3.5" />}
          </button>
        </div>

        {/* Navigation list */}
        <div className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
          {/* Public / Customer Booking links */}
          <div>
            {!collapsed && (
              <div className="px-3 mb-1.5 text-[10px] font-semibold tracking-wider text-slate-400 uppercase">
                Customer
              </div>
            )}
            <nav className="space-y-0.5">
              <button
                onClick={() => handleNav('book')}
                className={`w-full ${navItemClass('book')}`}
                title="Book Appointment"
              >
                <PlusCircle className="w-4 h-4 shrink-0 text-slate-700" />
                {!collapsed && <span>Book Appointment</span>}
              </button>

              <button
                onClick={() => handleNav('my-appointments')}
                className={`w-full ${navItemClass('my-appointments')}`}
                title="My Bookings"
              >
                <BookmarkCheck className="w-4 h-4 shrink-0" />
                {!collapsed && <span>My Bookings</span>}
              </button>
            </nav>
          </div>

          {/* Admin & Staff Sections */}
          {(role === 'ADMIN' || role === 'STAFF') && (
            <div>
              {!collapsed && (
                <div className="px-3 mb-1.5 text-[10px] font-semibold tracking-wider text-slate-400 uppercase">
                  Workspace
                </div>
              )}
              <nav className="space-y-0.5">
                <button
                  onClick={() => handleNav('dashboard')}
                  className={`w-full ${navItemClass('dashboard')}`}
                  title="Dashboard"
                >
                  <LayoutDashboard className="w-4 h-4 shrink-0" />
                  {!collapsed && <span>Overview</span>}
                </button>

                <button
                  onClick={() => handleNav('appointments')}
                  className={`w-full ${navItemClass('appointments')}`}
                  title="Appointments"
                >
                  <CalendarCheck2 className="w-4 h-4 shrink-0" />
                  {!collapsed && <span>Appointments</span>}
                </button>

                <button
                  onClick={() => handleNav('calendar')}
                  className={`w-full ${navItemClass('calendar')}`}
                  title="Calendar"
                >
                  <CalendarIcon className="w-4 h-4 shrink-0" />
                  {!collapsed && <span>Calendar</span>}
                </button>

                {role === 'ADMIN' && (
                  <button
                    onClick={() => handleNav('customers')}
                    className={`w-full ${navItemClass('customers')}`}
                    title="Customers"
                  >
                    <Users className="w-4 h-4 shrink-0" />
                    {!collapsed && <span>Customers</span>}
                  </button>
                )}
              </nav>
            </div>
          )}

          {/* Management */}
          {(role === 'ADMIN' || role === 'STAFF') && (
            <div>
              {!collapsed && (
                <div className="px-3 mb-1.5 text-[10px] font-semibold tracking-wider text-slate-400 uppercase">
                  Management
                </div>
              )}
              <nav className="space-y-0.5">
                {role === 'ADMIN' && (
                  <>
                    <button
                      onClick={() => handleNav('services')}
                      className={`w-full ${navItemClass('services')}`}
                      title="Services"
                    >
                      <Briefcase className="w-4 h-4 shrink-0" />
                      {!collapsed && <span>Services</span>}
                    </button>

                    <button
                      onClick={() => handleNav('staff')}
                      className={`w-full ${navItemClass('staff')}`}
                      title="Staff Team"
                    >
                      <UserCog className="w-4 h-4 shrink-0" />
                      {!collapsed && <span>Staff Team</span>}
                    </button>
                  </>
                )}

                <button
                  onClick={() => handleNav('availability')}
                  className={`w-full ${navItemClass('availability')}`}
                  title="Schedule & Availability"
                >
                  <Clock className="w-4 h-4 shrink-0" />
                  {!collapsed && <span>Availability</span>}
                </button>
              </nav>
            </div>
          )}

          {/* System */}
          {role === 'ADMIN' && (
            <div>
              {!collapsed && (
                <div className="px-3 mb-1.5 text-[10px] font-semibold tracking-wider text-slate-400 uppercase">
                  System
                </div>
              )}
              <nav className="space-y-0.5">
                <button
                  onClick={() => handleNav('analytics')}
                  className={`w-full ${navItemClass('analytics')}`}
                  title="Analytics"
                >
                  <BarChart3 className="w-4 h-4 shrink-0" />
                  {!collapsed && <span>Analytics</span>}
                </button>

                <button
                  onClick={() => handleNav('settings')}
                  className={`w-full ${navItemClass('settings')}`}
                  title="Settings"
                >
                  <Settings className="w-4 h-4 shrink-0" />
                  {!collapsed && <span>Settings</span>}
                </button>
              </nav>
            </div>
          )}
        </div>

        {/* Bottom User Profile */}
        <div className="p-3 border-t border-slate-200/80">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-slate-100 overflow-hidden shrink-0 border border-slate-200">
              {user?.avatarUrl ? (
                <img src={user.avatarUrl} alt={user.name} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center font-mono text-[10px] font-bold text-slate-700">
                  {user?.name ? user.name.slice(0, 2).toUpperCase() : 'BF'}
                </div>
              )}
            </div>

            {!collapsed && (
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-slate-900 truncate">
                  {user?.name || 'Guest'}
                </p>
                <span className="text-[10px] text-slate-400 font-mono uppercase tracking-wider block">
                  {role}
                </span>
              </div>
            )}

            {!collapsed && (
              <button
                onClick={logout}
                title="Log out"
                className="p-1.5 text-slate-400 hover:text-slate-800 rounded transition-colors"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </aside>
    </>
  );
};
