import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext.tsx';
import { ToastProvider } from './components/ui/Toast.tsx';
import { Sidebar } from './components/layout/Sidebar.tsx';
import { Header } from './components/layout/Header.tsx';
import { PublicBooking } from './components/booking/PublicBooking.tsx';
import { CustomerAppointments } from './components/customer/CustomerAppointments.tsx';
import { AdminDashboard } from './components/admin/AdminDashboard.tsx';
import { AppointmentsPage } from './components/admin/AppointmentsPage.tsx';
import { CalendarPage } from './components/admin/CalendarPage.tsx';
import { CustomersPage } from './components/admin/CustomersPage.tsx';
import { ServicesPage } from './components/admin/ServicesPage.tsx';
import { StaffPage } from './components/admin/StaffPage.tsx';
import { StaffDashboard } from './components/staff/StaffDashboard.tsx';
import { AnalyticsPage } from './components/admin/AnalyticsPage.tsx';
import { SettingsPage } from './components/admin/SettingsPage.tsx';
import { NewAppointmentModal } from './components/admin/NewAppointmentModal.tsx';
import { Appointment } from './types/index.ts';

const AppContent: React.FC = () => {
  const { user } = useAuth();
  const [currentTab, setCurrentTab] = useState<string>('book');
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(false);
  const [mobileOpen, setMobileOpen] = useState<boolean>(false);

  // Global New Appointment Modal state
  const [isNewBookingModalOpen, setIsNewBookingModalOpen] = useState<boolean>(false);

  // Active drawer appointment (for opening drawer from Dashboard or Calendar)
  const [selectedDrawerApt, setSelectedDrawerApt] = useState<Appointment | null>(null);

  const handleOpenDrawerFromElsewhere = (apt: Appointment) => {
    setSelectedDrawerApt(apt);
    setCurrentTab('appointments');
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex">
      {/* Collapsible Sidebar */}
      <Sidebar
        currentTab={currentTab}
        setCurrentTab={setCurrentTab}
        collapsed={sidebarCollapsed}
        setCollapsed={setSidebarCollapsed}
        mobileOpen={mobileOpen}
        setMobileOpen={setMobileOpen}
      />

      {/* Main Content Area */}
      <div
        className={`flex-1 flex flex-col transition-all duration-200 ease-in-out min-w-0 ${
          sidebarCollapsed ? 'md:ml-[72px]' : 'md:ml-[256px]'
        }`}
      >
        {/* Top Sticky Header */}
        <Header
          currentTab={currentTab}
          setMobileOpen={setMobileOpen}
          openNewBookingModal={() => setIsNewBookingModalOpen(true)}
        />

        {/* View Routing */}
        <main className="flex-1 pb-16">
          {currentTab === 'book' && (
            <PublicBooking onViewAppointments={() => setCurrentTab('my-appointments')} />
          )}

          {currentTab === 'my-appointments' && (
            <CustomerAppointments onBookNew={() => setCurrentTab('book')} />
          )}

          {currentTab === 'dashboard' && (
            <AdminDashboard
              onNewAppointment={() => setIsNewBookingModalOpen(true)}
              onNavigateTab={(tab) => setCurrentTab(tab)}
              onViewAppointmentDetails={handleOpenDrawerFromElsewhere}
            />
          )}

          {currentTab === 'appointments' && (
            <AppointmentsPage
              onNewAppointment={() => setIsNewBookingModalOpen(true)}
              selectedDrawerApt={selectedDrawerApt}
              onCloseDrawer={() => setSelectedDrawerApt(null)}
            />
          )}

          {currentTab === 'calendar' && (
            <CalendarPage
              onNewAppointment={() => setIsNewBookingModalOpen(true)}
              onViewAppointmentDetails={handleOpenDrawerFromElsewhere}
            />
          )}

          {currentTab === 'customers' && (
            <CustomersPage onBookForCustomer={() => setIsNewBookingModalOpen(true)} />
          )}

          {currentTab === 'services' && <ServicesPage />}

          {currentTab === 'staff' && (
            <StaffPage onViewSchedule={() => setCurrentTab('availability')} />
          )}

          {currentTab === 'availability' && <StaffDashboard />}

          {currentTab === 'analytics' && <AnalyticsPage />}

          {currentTab === 'settings' && <SettingsPage />}
        </main>
      </div>

      {/* Global Quick New Appointment Modal */}
      <NewAppointmentModal
        isOpen={isNewBookingModalOpen}
        onClose={() => setIsNewBookingModalOpen(false)}
        onSuccess={() => {
          // Refresh current page if needed
          setSelectedDrawerApt(null);
        }}
      />
    </div>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <AppContent />
      </ToastProvider>
    </AuthProvider>
  );
}
