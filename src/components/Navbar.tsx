import React, { useState } from 'react';
import {
  Truck,
  Sun,
  Moon,
  Search,
  Plus,
  Bell,
  LogOut,
  RotateCcw,
  Sparkles,
  ChevronDown,
} from 'lucide-react';
import { useApp, ActiveView } from '../context/AppContext';
import { useTheme } from '../context/ThemeContext';
import { UserRole } from '../types';

interface NavbarProps {
  onOpenNewTripModal?: () => void;
  onOpenAddVehicleModal?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  onOpenNewTripModal,
  onOpenAddVehicleModal,
}) => {
  const {
    activeView,
    setActiveView,
    currentUser,
    userRole,
    setUserRole,
    logout,
    searchQuery,
    setSearchQuery,
    selectedRegion,
    setSelectedRegion,
    notifications,
    showSplashAgain,
  } = useApp();
  const { theme, toggleTheme } = useTheme();
  const [showRoleDropdown, setShowRoleDropdown] = useState(false);
  const [showNotifPopover, setShowNotifPopover] = useState(false);

  const isPublicView = activeView === 'hero' || activeView === 'login' || activeView === 'register';

  const roleLabels: Record<UserRole, { title: string; badge: string }> = {
    fleet_manager: { title: 'Fleet Manager', badge: 'Control Tower' },
    driver: { title: 'Driver / Dispatcher', badge: 'Dispatch Desk' },
    safety_officer: { title: 'Safety Officer', badge: 'Compliance Watch' },
    financial_analyst: { title: 'Financial Analyst', badge: 'Cost Console' },
  };

  const handleRoleChange = (role: UserRole) => {
    setUserRole(role);
    setShowRoleDropdown(false);
  };

  return (
    <header
      className={`sticky top-0 z-40 shrink-0 border-b backdrop-blur-md transition-colors ${
        theme === 'dark'
          ? 'bg-[#0f1116]/90 border-[#222733] text-neutral-100'
          : 'bg-[#faf8f4]/90 border-[#e7e1d5] text-neutral-900'
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        {/* Left: Brand Identity */}
        <div className="flex items-center gap-6">
          <button
            onClick={() => setActiveView(currentUser ? 'dashboard' : 'hero')}
            className="flex items-center gap-2.5 text-left group"
          >
            <div
              className={`w-9 h-9 rounded-lg flex items-center justify-center transition-transform group-hover:scale-105 ${
                theme === 'dark'
                  ? 'bg-[#ccff00] text-black shadow-[0_0_15px_rgba(204,255,0,0.3)]'
                  : 'bg-[#d97706] text-white shadow-md'
              }`}
            >
              <Truck className="w-5 h-5 stroke-[2.2]" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    theme === 'dark' ? 'bg-[#ccff00]' : 'bg-[#d97706]'
                  }`}
                />
                <span className="font-extrabold text-sm tracking-wider uppercase">
                  TRANSITOPS
                </span>
              </div>
              <span className="text-[10px] block font-mono text-neutral-400">
                Fleet Management
              </span>
            </div>
          </button>



          {/* In-App Global Search */}
          {!isPublicView && (
            <div className="hidden md:flex items-center relative w-64 lg:w-80">
              <Search className="w-4 h-4 absolute left-3 text-neutral-400 pointer-events-none" />
              <input
                type="text"
                placeholder="Search vehicles, drivers, trips..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={`w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border outline-none transition-all ${
                  theme === 'dark'
                    ? 'bg-[#151921] border-[#252b36] focus:border-[#ccff00] text-neutral-200 placeholder:text-neutral-500'
                    : 'bg-white border-[#e2dbce] focus:border-[#d97706] text-neutral-800 placeholder:text-neutral-400'
                }`}
              />
            </div>
          )}
        </div>

        {/* Right Controls */}
        <div className="flex items-center gap-2.5">
          {/* Quick Region Selector (When in App) */}
          {!isPublicView && (
            <div className="hidden lg:block">
              <select
                value={selectedRegion}
                onChange={(e) => setSelectedRegion(e.target.value)}
                className={`text-xs px-2.5 py-1.5 rounded-lg border outline-none font-medium cursor-pointer ${
                  theme === 'dark'
                    ? 'bg-[#151921] border-[#252b36] text-neutral-300 hover:border-neutral-600'
                    : 'bg-white border-[#e2dbce] text-neutral-700 hover:border-neutral-400'
                }`}
              >
                <option value="All">All Regions (Global)</option>
                <option value="Mumbai West">Mumbai West Hub</option>
                <option value="Pune Hub">Pune Hub</option>
                <option value="Bangalore South">Bangalore South</option>
                <option value="Delhi NCR Hub">Delhi NCR Hub</option>
                <option value="Chennai Port Hub">Chennai Port Hub</option>
                <option value="Ahmedabad Industrial">Ahmedabad Hub</option>
              </select>
            </div>
          )}

          {/* Quick Action Button (Fleet Manager or Driver only) */}
          {!isPublicView && (userRole === 'fleet_manager' || userRole === 'driver') && onOpenNewTripModal && (
            <button
              onClick={onOpenNewTripModal}
              className={`hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all shadow-sm ${
                theme === 'dark'
                  ? 'bg-[#ccff00] text-black hover:bg-[#bbf000]'
                  : 'bg-[#d97706] text-white hover:bg-[#b45309]'
              }`}
            >
              <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>New Dispatch</span>
            </button>
          )}

          {/* Notification Bell (Only shown when logged in and inside app) */}
          {currentUser && !isPublicView && (
            <div className="relative">
              <button
                onClick={() => setShowNotifPopover(!showNotifPopover)}
                aria-label="Notifications"
                className={`relative p-2 rounded-lg border transition-colors ${
                  theme === 'dark'
                    ? 'bg-[#151921] border-[#252b36] hover:bg-[#1f2430] text-neutral-300'
                    : 'bg-white border-[#e2dbce] hover:bg-neutral-100 text-neutral-700'
                }`}
              >
                <Bell className="w-4 h-4" />
                {notifications.length > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 text-[9px] font-bold text-white flex items-center justify-center animate-pulse">
                    {notifications.length}
                  </span>
                )}
              </button>

              {/* Notification popover */}
              {showNotifPopover && (
                <div
                  className={`absolute right-0 mt-2 w-80 rounded-xl border shadow-2xl p-3 z-50 text-xs ${
                    theme === 'dark'
                      ? 'bg-[#161a22] border-[#282f3d] text-neutral-100'
                      : 'bg-white border-[#e5dfd2] text-neutral-900'
                  }`}
                >
                  <div className="flex items-center justify-between pb-2 mb-2 border-b border-inherit font-bold">
                    <span>Operational Alerts ({notifications.length})</span>
                    <button
                      onClick={() => setShowNotifPopover(false)}
                      className="text-[10px] text-neutral-400 hover:underline"
                    >
                      Close
                    </button>
                  </div>
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {notifications.length === 0 ? (
                      <p className="text-neutral-400 py-4 text-center">No active alerts</p>
                    ) : (
                      notifications.map((n) => (
                        <div
                          key={n.id}
                          className={`p-2 rounded-lg border ${
                            theme === 'dark'
                              ? 'bg-[#1c212c] border-[#2e3747]'
                              : 'bg-neutral-50 border-[#ede7dc]'
                          }`}
                        >
                          <div className="flex items-center justify-between font-semibold">
                            <span
                              className={
                                n.type === 'error'
                                  ? 'text-red-400'
                                  : n.type === 'warning'
                                  ? 'text-amber-400'
                                  : 'text-emerald-400'
                              }
                            >
                              {n.title}
                            </span>
                            <span className="text-[10px] text-neutral-400">{n.timestamp}</span>
                          </div>
                          <p className="text-[11px] text-neutral-400 mt-0.5">{n.message}</p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Theme Toggle (Dark / Light as requested in prompt) */}
          <button
            onClick={toggleTheme}
            aria-label="Toggle theme"
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-colors ${
              theme === 'dark'
                ? 'bg-[#151921] border-[#252b36] hover:bg-[#1f2430] text-neutral-200'
                : 'bg-white border-[#e2dbce] hover:bg-neutral-100 text-neutral-800'
            }`}
          >
            {theme === 'dark' ? (
              <>
                <Sun className="w-3.5 h-3.5 text-[#ccff00]" />
                <span className="hidden sm:inline">Light</span>
              </>
            ) : (
              <>
                <Moon className="w-3.5 h-3.5 text-[#d97706]" />
                <span className="hidden sm:inline">Dark</span>
              </>
            )}
          </button>

          {/* Role Switcher or Auth CTA (Do not show roles on hero/public branding) */}
          {currentUser && !isPublicView ? (
            <div className="relative">
              <button
                onClick={() => setShowRoleDropdown(!showRoleDropdown)}
                className={`flex items-center gap-2 pl-2 pr-2.5 py-1 rounded-lg border transition-all ${
                  theme === 'dark'
                    ? 'bg-[#151921] border-[#252b36] hover:border-neutral-600'
                    : 'bg-white border-[#e2dbce] hover:border-neutral-400'
                }`}
              >
                <div
                  className={`w-6 h-6 rounded-md flex items-center justify-center font-bold text-[11px] ${
                    theme === 'dark'
                      ? 'bg-[#ccff00]/20 text-[#ccff00]'
                      : 'bg-amber-100 text-amber-900'
                  }`}
                >
                  {currentUser.name.charAt(0)}
                </div>
                <div className="text-left hidden sm:block">
                  <div className="text-xs font-bold leading-tight flex items-center gap-1">
                    <span>{currentUser.name}</span>
                    <ChevronDown className="w-3 h-3 opacity-60" />
                  </div>
                  <span
                    className={`text-[10px] font-mono ${
                      theme === 'dark' ? 'text-[#ccff00]' : 'text-[#d97706]'
                    }`}
                  >
                    {roleLabels[userRole]?.title}
                  </span>
                </div>
              </button>

              {/* Role Switcher Menu */}
              {showRoleDropdown && (
                <div
                  className={`absolute right-0 mt-2 w-64 rounded-xl border shadow-2xl p-2 z-50 text-xs ${
                    theme === 'dark'
                      ? 'bg-[#14171f] border-[#282f3d] text-neutral-100'
                      : 'bg-white border-[#e5dfd2] text-neutral-900'
                  }`}
                >
                  <div className="px-2.5 py-2 mb-1 border-b border-inherit">
                    <span className="text-[10px] uppercase font-bold text-neutral-400 tracking-wider">
                      Switch Active Role (RBAC)
                    </span>
                  </div>
                  {(Object.keys(roleLabels) as UserRole[]).map((r) => (
                    <button
                      key={r}
                      onClick={() => handleRoleChange(r)}
                      className={`w-full text-left px-2.5 py-2 rounded-lg flex items-center justify-between transition-colors ${
                        userRole === r
                          ? theme === 'dark'
                            ? 'bg-[#ccff00]/15 text-[#ccff00] font-bold'
                            : 'bg-amber-50 text-amber-900 font-bold'
                          : 'hover:bg-neutral-100 dark:hover:bg-[#1e2330]'
                      }`}
                    >
                      <div>
                        <div className="font-semibold">{roleLabels[r].title}</div>
                        <div className="text-[10px] text-neutral-400">{roleLabels[r].badge}</div>
                      </div>
                      {userRole === r && (
                        <span
                          className={`w-2 h-2 rounded-full ${
                            theme === 'dark' ? 'bg-[#ccff00]' : 'bg-[#d97706]'
                          }`}
                        />
                      )}
                    </button>
                  ))}

                  <div className="mt-2 pt-1 border-t border-inherit space-y-1">
                    <button
                      onClick={() => {
                        setShowRoleDropdown(false);
                        showSplashAgain();
                      }}
                      className="w-full text-left px-2.5 py-1.5 rounded-lg flex items-center gap-2 hover:bg-neutral-100 dark:hover:bg-[#1e2330] transition-colors text-neutral-400 hover:text-neutral-200 font-semibold"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                      <span>Replay Splash Screen</span>
                    </button>
                    <button
                      onClick={() => {
                        setShowRoleDropdown(false);
                        logout();
                      }}
                      className="w-full text-left px-2.5 py-1.5 rounded-lg flex items-center gap-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors font-semibold"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      <span>Sign Out</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setActiveView('login')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                  theme === 'dark'
                    ? 'text-neutral-300 hover:text-white'
                    : 'text-neutral-700 hover:text-neutral-900'
                }`}
              >
                Sign In
              </button>
              <button
                onClick={() => setActiveView('register')}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all shadow-sm ${
                  theme === 'dark'
                    ? 'bg-[#ccff00] text-black hover:bg-[#bbf000]'
                    : 'bg-[#d97706] text-white hover:bg-[#b45309]'
                }`}
              >
                Get Started
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
