import React, { useEffect, useState } from 'react';
import { ThemeProvider, useTheme } from './context/ThemeContext';
import { AppProvider, useApp } from './context/AppContext';
import { SplashScreen } from './components/SplashScreen';
import { Navbar } from './components/Navbar';
import { Sidebar } from './components/Sidebar';
import { NotificationToast } from './components/NotificationToast';

// Modals
import { CreateTripModal } from './components/modals/CreateTripModal';
import { CompleteTripModal } from './components/modals/CompleteTripModal';
import { AddVehicleModal } from './components/modals/AddVehicleModal';
import { LogMaintenanceModal } from './components/modals/LogMaintenanceModal';
import { AddDriverModal } from './components/modals/AddDriverModal';

// Views
import { LoginView } from './components/views/AuthViews';
import { HeroView } from './components/views/HeroView';
import { SaasOnboardingView } from './components/views/SaasOnboardingView';
import { DashboardView } from './components/views/DashboardView';
import { VehiclesView } from './components/views/VehiclesView';
import { TripsView } from './components/views/TripsView';
import { DriversView } from './components/views/DriversView';
import { MaintenanceView } from './components/views/MaintenanceView';
import { ExpensesView } from './components/views/ExpensesView';
import { ReportsView } from './components/views/ReportsView';
import { OrganizationAdminDashboard } from './components/views/OrganizationAdminDashboard';
import { Trip, UserRole } from './types';

const MainLayout: React.FC = () => {
  const { activeView, setActiveView, isSplashActive, dismissSplash, currentUser } = useApp();
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const allowedViews: Record<UserRole, string[]> = {
    organization_admin: ['organization_admin'],
    fleet_manager: ['dashboard', 'vehicles', 'drivers', 'trips', 'maintenance', 'expenses', 'reports', 'analytics'],
    driver: ['dashboard', 'vehicles', 'trips'],
    safety_officer: ['dashboard', 'vehicles', 'drivers', 'maintenance'],
    financial_analyst: ['dashboard', 'vehicles', 'trips', 'maintenance', 'expenses', 'reports', 'analytics'],
  };
  const isPublicFlow = activeView === 'purchase' || activeView === 'setup_account';
  const view = isPublicFlow
    ? activeView
    : currentUser
    ? allowedViews[currentUser.role].includes(activeView)
      ? activeView
      : currentUser.role === 'organization_admin' ? 'organization_admin' : 'dashboard'
    : ['hero', 'login', 'purchase', 'setup_account'].includes(activeView) ? activeView : 'login';

  useEffect(() => {
    if (view !== activeView) setActiveView(view as typeof activeView);
  }, [activeView, setActiveView, view]);

  // Modal States
  const [isNewTripOpen, setIsNewTripOpen] = useState(false);
  const [isAddVehicleOpen, setIsAddVehicleOpen] = useState(false);
  const [isAddDriverOpen, setIsAddDriverOpen] = useState(false);
  const [isLogMaintOpen, setIsLogMaintOpen] = useState(false);
  const [selectedMaintVehicleId, setSelectedMaintVehicleId] = useState<string | undefined>(undefined);
  const [tripToComplete, setTripToComplete] = useState<Trip | null>(null);

  const handleOpenLogMaintenance = (vehicleId?: string) => {
    setSelectedMaintVehicleId(vehicleId);
    setIsLogMaintOpen(true);
  };

  const isLogin = view === 'login';
  const isPublicView = ['hero', 'login', 'purchase', 'setup_account'].includes(view);

  return (
    <>
      {isSplashActive && (
        <SplashScreen
          key={isSplashActive ? 'active-splash' : 'inactive-splash'}
          onFinish={dismissSplash}
        />
      )}

      <div
        className={`${
          isLogin ? 'min-h-screen' : 'h-screen overflow-hidden'
        } flex flex-col font-sans transition-colors duration-200 ${
          isDark
            ? 'bg-[#0c0e12] text-neutral-100 selection:bg-[#ccff00] selection:text-black'
            : 'bg-[#faf8f4] text-neutral-900 selection:bg-[#d97706] selection:text-white'
        }`}
      >
        {/* Render Navbar only for authenticated app views */}
        {!isLogin && (
          <Navbar onOpenNewTripModal={() => setIsNewTripOpen(true)} />
        )}

        {/* Dynamic Body Layout */}
        {isPublicView ? (
          <main className="flex-1 overflow-y-auto">
            {view === 'hero' && <HeroView />}
            {view === 'login' && <LoginView />}
            {(view === 'purchase' || view === 'setup_account') && (
              <SaasOnboardingView initialMode={view === 'setup_account' ? 'setup' : 'purchase'} />
            )}
          </main>
        ) : (
          <div className="flex-1 flex overflow-hidden min-h-0">
            {/* Desktop and Mobile Sidebar (Static Navigation Panel) */}
            <Sidebar />

            {/* Main Scrollable Content */}
            <main className="flex-1 overflow-y-auto h-full pb-20 md:pb-8">
              {view === 'dashboard' && (
                <DashboardView
                  onOpenNewTripModal={() => setIsNewTripOpen(true)}
                  onOpenAddVehicleModal={() => setIsAddVehicleOpen(true)}
                  onOpenAddDriverModal={() => setIsAddDriverOpen(true)}
                  onOpenLogMaintModal={() => handleOpenLogMaintenance()}
                  onOpenCompleteTripModal={(trip) => setTripToComplete(trip)}
                />
              )}
              {view === 'vehicles' && (
                <VehiclesView
                  onOpenAddVehicleModal={() => setIsAddVehicleOpen(true)}
                  onOpenLogMaintModal={handleOpenLogMaintenance}
                />
              )}
              {view === 'trips' && (
                <TripsView
                  onOpenNewTripModal={() => setIsNewTripOpen(true)}
                  onOpenCompleteTripModal={(trip) => setTripToComplete(trip)}
                />
              )}
              {view === 'drivers' && (
                <DriversView onOpenAddDriverModal={() => setIsAddDriverOpen(true)} />
              )}
              {view === 'maintenance' && (
                <MaintenanceView onOpenLogMaintModal={() => handleOpenLogMaintenance()} />
              )}
              {view === 'expenses' && (
                <ExpensesView onOpenLogMaintModal={() => handleOpenLogMaintenance()} />
              )}
              {view === 'reports' && (
                <ReportsView />
              )}
              {view === 'analytics' && (
                <ReportsView />
              )}
              {view === 'organization_admin' && <OrganizationAdminDashboard />}
            </main>
          </div>
        )}

        {/* Global Toast Notification System */}
        {currentUser && <NotificationToast />}

        {/* Global Modals with Autonomous Rule Enforcement */}
        <CreateTripModal
          isOpen={isNewTripOpen}
          onClose={() => setIsNewTripOpen(false)}
        />

        <CompleteTripModal
          isOpen={tripToComplete !== null}
          trip={tripToComplete}
          onClose={() => setTripToComplete(null)}
        />

        <AddVehicleModal
          isOpen={isAddVehicleOpen}
          onClose={() => setIsAddVehicleOpen(false)}
        />

        <LogMaintenanceModal
          isOpen={isLogMaintOpen}
          defaultVehicleId={selectedMaintVehicleId}
          onClose={() => {
            setIsLogMaintOpen(false);
            setSelectedMaintVehicleId(undefined);
          }}
        />

        <AddDriverModal
          isOpen={isAddDriverOpen}
          onClose={() => setIsAddDriverOpen(false)}
        />
      </div>
    </>
  );
};

export default function App() {
  return (
    <ThemeProvider>
      <AppProvider>
        <MainLayout />
      </AppProvider>
    </ThemeProvider>
  );
}
