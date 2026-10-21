import React from 'react';
import {
  LayoutDashboard,
  Truck,
  Users,
  Route,
  Wrench,
  Fuel,
  BarChart3,
  ShieldCheck,
  Building2,
  DollarSign,
} from 'lucide-react';
import { useApp, ActiveView } from '../context/AppContext';
import { useTheme } from '../context/ThemeContext';

export const Sidebar: React.FC = () => {
  const { activeView, setActiveView, userRole, vehicles, drivers, trips } = useApp();
  const { theme } = useTheme();

  const isDark = theme === 'dark';

  // Badges & Counters
  const inShopCount = vehicles.filter((v) => v.status === 'In Shop').length;
  const activeTripsCount = trips.filter((t) => t.status === 'Dispatched').length;
  const suspendedDriversCount = drivers.filter((d) => d.status === 'Suspended').length;

  const navItems = [
    {
      id: 'organization_admin' as ActiveView,
      label: 'Organization Admin',
      icon: Building2,
      badge: null,
      roles: ['organization_admin'],
    },
    {
      id: 'dashboard' as ActiveView,
      label: 'Dashboard',
      icon: LayoutDashboard,
      badge: null,
      roles: ['fleet_manager', 'driver', 'safety_officer', 'financial_analyst'],
    },
    {
      id: 'vehicles' as ActiveView,
      label: 'Vehicles',
      icon: Truck,
      badge: inShopCount > 0 ? `${inShopCount} shop` : `${vehicles.length}`,
      badgeColor: inShopCount > 0 ? 'shop' : 'default',
      roles: ['fleet_manager', 'driver', 'safety_officer', 'financial_analyst'],
    },
    {
      id: 'drivers' as ActiveView,
      label: 'Drivers',
      icon: Users,
      badge: suspendedDriversCount > 0 ? `${suspendedDriversCount} alert` : `${drivers.length}`,
      badgeColor: suspendedDriversCount > 0 ? 'alert' : 'default',
      roles: ['fleet_manager', 'safety_officer'],
    },
    {
      id: 'trips' as ActiveView,
      label: 'Trips & Dispatch',
      icon: Route,
      badge: activeTripsCount > 0 ? `${activeTripsCount} live` : null,
      badgeColor: 'live',
      roles: ['fleet_manager', 'driver'],
    },
    {
      id: 'maintenance' as ActiveView,
      label: 'Maintenance',
      icon: Wrench,
      badge: inShopCount > 0 ? `${inShopCount}` : null,
      badgeColor: 'shop',
      roles: ['fleet_manager', 'safety_officer', 'financial_analyst'],
    },
    {
      id: 'expenses' as ActiveView,
      label: 'Fuels and Expenses',
      icon: Fuel,
      badge: null,
      roles: ['fleet_manager', 'financial_analyst'],
    },
    {
      id: 'reports' as ActiveView,
      label: 'Reports & ROI',
      icon: BarChart3,
      badge: null,
      roles: ['fleet_manager', 'financial_analyst'],
    },
  ];

  // Filter items visible to the current role (RBAC)
  const visibleNavItems = navItems.filter((item) => item.roles.includes(userRole));

  return (
    <>
      {/* Desktop Sidebar (Left Column) */}
      <aside
        className={`hidden md:flex flex-col w-64 border-r shrink-0 h-full max-h-[calc(100vh-4rem)] overflow-y-auto p-4 transition-colors ${
          isDark
            ? 'bg-[#12151c] border-[#222733] text-neutral-200'
            : 'bg-[#faf8f4] border-[#e7e1d5] text-neutral-800'
        }`}
      >
        {/* Workspace Role Summary Banner */}
        <div
          className={`p-3 rounded-xl mb-4 border ${
            isDark
              ? 'bg-[#161a23] border-[#252b36]'
              : 'bg-white border-[#e5dfd2] shadow-xs'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase tracking-wider font-extrabold text-neutral-400">
              Active Context
            </span>
            <span
              className={`w-2 h-2 rounded-full ${
                isDark ? 'bg-[#ccff00]' : 'bg-[#d97706]'
              }`}
            />
          </div>
          <div className="mt-1 flex items-center gap-2">
            {userRole === 'fleet_manager' && <Building2 className="w-4 h-4 text-blue-400" />}
            {userRole === 'driver' && <Route className="w-4 h-4 text-emerald-400" />}
            {userRole === 'safety_officer' && <ShieldCheck className="w-4 h-4 text-purple-400" />}
            {userRole === 'financial_analyst' && <DollarSign className="w-4 h-4 text-amber-400" />}
            <span className="font-bold text-sm capitalize">
              {userRole.replace('_', ' ')}
            </span>
          </div>
          <p className="text-[11px] text-neutral-400 mt-1 leading-tight">
            {userRole === 'fleet_manager' && 'Assets, trips, maintenance & operational efficiency.'}
            {userRole === 'organization_admin' && 'Create accounts and assign roles in this organization.'}
            {userRole === 'driver' && 'Trip creation, assignments, and dispatch execution.'}
            {userRole === 'safety_officer' && 'Driver compliance, license validation, safety scores.'}
            {userRole === 'financial_analyst' && 'Fuel logs, vehicle ROI, cost-per-km trends.'}
          </p>
        </div>

        {/* Navigation Section */}
        <div className="space-y-1">
          <div className="text-[10px] uppercase font-bold text-neutral-400 tracking-wider px-3 mb-2">
            Workspace Navigation
          </div>
          {visibleNavItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeView === item.id;

            return (
              <button
                key={item.id}
                onClick={() => setActiveView(item.id)}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition-all group ${
                  isActive
                    ? isDark
                      ? 'bg-[#ccff00] text-black shadow-md font-bold'
                      : 'bg-[#d97706] text-white shadow-md font-bold'
                    : isDark
                    ? 'text-neutral-400 hover:text-white hover:bg-[#181d27]'
                    : 'text-neutral-600 hover:text-neutral-900 hover:bg-[#ede8dd]'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon
                    className={`w-4 h-4 transition-transform group-hover:scale-110 ${
                      isActive
                        ? isDark
                          ? 'text-black'
                          : 'text-white'
                        : isDark
                        ? 'text-neutral-400 group-hover:text-neutral-200'
                        : 'text-neutral-500 group-hover:text-neutral-900'
                    }`}
                  />
                  <span>{item.label}</span>
                </div>

                {item.badge && (
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold ${
                      isActive
                        ? isDark
                          ? 'bg-black/20 text-black'
                          : 'bg-black/20 text-white'
                        : item.badgeColor === 'shop'
                        ? 'bg-red-500/15 text-red-400 border border-red-500/20'
                        : item.badgeColor === 'live'
                        ? 'bg-amber-500/15 text-amber-400 border border-amber-500/20'
                        : item.badgeColor === 'alert'
                        ? 'bg-purple-500/15 text-purple-400 border border-purple-500/20'
                        : isDark
                        ? 'bg-[#1e2330] text-neutral-400'
                        : 'bg-[#ede8dc] text-neutral-700'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Fleet Quick Status Card at sidebar bottom */}
        {userRole !== 'organization_admin' && (
          <div className="mt-auto pt-4 border-t border-inherit">
            <div
              className={`p-3 rounded-xl text-xs ${
                isDark ? 'bg-[#151921] border border-[#242a36]' : 'bg-white border border-[#e2dbce]'
              }`}
            >
              <div className="flex items-center justify-between font-bold mb-2">
                <span className="text-[11px] text-neutral-400 uppercase tracking-wider">Fleet Status</span>
                <span
                  className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${
                    isDark ? 'bg-[#ccff00]/15 text-[#ccff00]' : 'bg-amber-100 text-amber-800'
                  }`}
                >
                  Rule Engine ON
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-center text-[11px]">
                <div
                  className={`p-1.5 rounded-lg ${
                    isDark ? 'bg-[#1b202c]' : 'bg-neutral-50'
                  }`}
                >
                  <div className="text-[10px] text-neutral-400">Available</div>
                  <div className="font-bold text-emerald-500">
                    {vehicles.filter((v) => v.status === 'Available').length}
                  </div>
                </div>
                <div
                  className={`p-1.5 rounded-lg ${
                    isDark ? 'bg-[#1b202c]' : 'bg-neutral-50'
                  }`}
                >
                  <div className="text-[10px] text-neutral-400">In Shop</div>
                  <div className="font-bold text-red-500">{inShopCount}</div>
                </div>
              </div>
            </div>
          </div>
        )}
      </aside>

      {/* Mobile Bottom Navigation Bar */}
      <nav
        className={`md:hidden fixed bottom-0 left-0 right-0 z-40 border-t flex items-center overflow-x-auto py-2 px-2 gap-1 backdrop-blur-lg no-scrollbar ${
          isDark
            ? 'bg-[#0f1116]/95 border-[#222733] text-neutral-300'
            : 'bg-[#faf8f4]/95 border-[#e7e1d5] text-neutral-700'
        }`}
      >
        {visibleNavItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeView === item.id;

          return (
            <button
              key={item.id}
              onClick={() => setActiveView(item.id)}
              className={`flex flex-col items-center gap-1 py-1 px-2.5 rounded-lg transition-colors shrink-0 relative ${
                isActive
                  ? isDark
                    ? 'text-[#ccff00] font-bold'
                    : 'text-[#d97706] font-bold'
                  : 'text-neutral-400 hover:text-neutral-100'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span className="text-[9px] whitespace-nowrap">{item.label}</span>
              {item.badge && (
                <span className="absolute top-0 right-1 w-2 h-2 rounded-full bg-red-500" />
              )}
            </button>
          );
        })}
      </nav>
    </>
  );
};
