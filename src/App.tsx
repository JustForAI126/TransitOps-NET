import React, { useState } from 'react';
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
import { HeroView } from './components/views/HeroView';
import { LoginView, RegisterView } from './components/views/AuthViews';
import { DashboardView } from './components/views/DashboardView';
import { VehiclesView } from './components/views/VehiclesView';
import { TripsView } from './components/views/TripsView';
import { DriversView } from './components/views/DriversView';
import { MaintenanceView } from './components/views/MaintenanceView';
import { ExpensesView } from './components/views/ExpensesView';
import { ReportsView } from './components/views/ReportsView';
import { AnalyticsView } from './components/views/AnalyticsView';
import { Trip } from './types';

const MainLayout: React.FC = () => {
  const { activeView, isSplashActive, dismissSplash, currentUser } = useApp();
  const { theme } = useTheme();
  const isDark = theme === 'dark';

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

  const isAuthOrHero =
    activeView === 'hero' || activeView === 'login' || activeView === 'register';

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
          isAuthOrHero ? 'min-h-screen' : 'h-screen overflow-hidden'
        } flex flex-col font-sans transition-colors duration-200 ${
          isDark
            ? 'bg-[#0c0e12] text-neutral-100 selection:bg-[#ccff00] selection:text-black'
            : 'bg-[#faf8f4] text-neutral-900 selection:bg-[#d97706] selection:text-white'
        }`}
      >
        {/* Render Navbar only on app views or hero */}
        {activeView !== 'login' && activeView !== 'register' && (
          <Navbar onOpenNewTripModal={() => setIsNewTripOpen(true)} />
        )}

        {/* Dynamic Body Layout */}
        {isAuthOrHero ? (
          <main className="flex-1 overflow-y-auto">
            {activeView === 'hero' && <HeroView />}
            {activeView === 'login' && <LoginView />}
            {activeView === 'register' && <RegisterView />}
          </main>
        ) : (
          <div className="flex-1 flex overflow-hidden min-h-0">
            {/* Desktop and Mobile Sidebar (Static Navigation Panel) */}
            <Sidebar onOpenNewTripModal={() => setIsNewTripOpen(true)} />

            {/* Main Scrollable Content */}
            <main className="flex-1 overflow-y-auto h-full pb-20 md:pb-8">
              {activeView === 'dashboard' && (
                <DashboardView
                  onOpenNewTripModal={() => setIsNewTripOpen(true)}
                  onOpenAddVehicleModal={() => setIsAddVehicleOpen(true)}
                  onOpenAddDriverModal={() => setIsAddDriverOpen(true)}
                  onOpenLogMaintModal={() => handleOpenLogMaintenance()}
                  onOpenCompleteTripModal={(trip) => setTripToComplete(trip)}
                />
              )}
              {activeView === 'vehicles' && (
                <VehiclesView
                  onOpenAddVehicleModal={() => setIsAddVehicleOpen(true)}
                  onOpenLogMaintModal={handleOpenLogMaintenance}
                />
              )}
              {activeView === 'trips' && (
                <TripsView
                  onOpenNewTripModal={() => setIsNewTripOpen(true)}
                  onOpenCompleteTripModal={(trip) => setTripToComplete(trip)}
                />
              )}
              {activeView === 'drivers' && (
                <DriversView onOpenAddDriverModal={() => setIsAddDriverOpen(true)} />
              )}
              {activeView === 'maintenance' && (
                <MaintenanceView onOpenLogMaintModal={() => handleOpenLogMaintenance()} />
              )}
              {activeView === 'expenses' && (
                <ExpensesView onOpenLogMaintModal={() => handleOpenLogMaintenance()} />
              )}
              {activeView === 'reports' && (
                <ReportsView />
              )}
              {activeView === 'analytics' && (
                <ReportsView />
              )}
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
