import React from 'react';
import {
  CheckCircle2,
  Circle,
  Truck,
  Users,
  Route,
  ArrowRight,
  ShieldCheck,
  Building2,
  Sparkles,
  Wrench,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useTheme } from '../../context/ThemeContext';

interface GettingStartedGuideProps {
  onOpenAddVehicleModal: () => void;
  onOpenAddDriverModal: () => void;
  onOpenNewTripModal: () => void;
}

export const GettingStartedGuide: React.FC<GettingStartedGuideProps> = ({
  onOpenAddVehicleModal,
  onOpenAddDriverModal,
  onOpenNewTripModal,
}) => {
  const { currentUser, vehicles, drivers, trips } = useApp();
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  if (currentUser?.role === 'safety_officer')
    return <SafetyOfficerGettingStartedGuide />;

  const hasVehicles = vehicles.length > 0;
  const hasDrivers = drivers.length > 0;
  const hasTrips = trips.length > 0;

  const completedSteps = (hasVehicles ? 1 : 0) + (hasDrivers ? 1 : 0) + (hasTrips ? 1 : 0);
  const progressPercent = Math.round((completedSteps / 3) * 100);

  return (
    <div
      className={`rounded-2xl border p-6 sm:p-8 transition-all ${
        isDark
          ? 'bg-neutral-900/90 border-neutral-800 shadow-2xl shadow-black/40'
          : 'bg-white border-neutral-200 shadow-xl shadow-neutral-200/50'
      }`}
    >
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-inherit">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
              <Sparkles className="w-3.5 h-3.5" />
              Production Workspace Ready
            </span>
            <span
              className={`text-xs px-2.5 py-0.5 rounded-md font-mono ${
                isDark ? 'bg-neutral-800 text-neutral-400' : 'bg-neutral-100 text-neutral-600'
              }`}
            >
              Tenant: {currentUser?.tenantId || 'Private Tenant'}
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight">
            Welcome to TransitOps, {currentUser?.name || 'Fleet Operator'}!
          </h2>
          <p className="text-sm text-neutral-500 dark:text-neutral-400 max-w-2xl">
            Your isolated workspace is connected and operational. Complete the 3 essential setup steps
            below to launch real-time fleet radar tracking, driver compliance, and financial analytics.
          </p>
        </div>

        {/* Progress indicator */}
        <div className="flex flex-col sm:items-end gap-2 shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-neutral-400">Setup Progress:</span>
            <span className="text-sm font-bold text-emerald-500">{completedSteps} of 3 Completed</span>
          </div>
          <div className="w-full sm:w-44 h-2.5 rounded-full bg-neutral-200 dark:bg-neutral-800 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-emerald-500 to-lime-400 transition-all duration-500"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      </div>

      {/* 3 Steps Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 pt-6">
        {/* Step 1: Vehicles */}
        <div
          className={`flex flex-col justify-between p-5 rounded-xl border transition-all ${
            hasVehicles
              ? isDark
                ? 'bg-emerald-950/20 border-emerald-500/30'
                : 'bg-emerald-50/50 border-emerald-200'
              : isDark
              ? 'bg-neutral-800/40 border-neutral-700/60 hover:border-neutral-600'
              : 'bg-neutral-50 border-neutral-200 hover:border-neutral-300'
          }`}
        >
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                  hasVehicles
                    ? 'bg-emerald-500/20 text-emerald-400'
                    : 'bg-neutral-200 dark:bg-neutral-800 text-neutral-500'
                }`}
              >
                <Truck className="w-5 h-5" />
              </div>
              {hasVehicles ? (
                <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-500">
                  <CheckCircle2 className="w-4 h-4" /> Done ({vehicles.length})
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-xs font-medium text-neutral-400">
                  <Circle className="w-3.5 h-3.5" /> Step 1
                </span>
              )}
            </div>
            <div>
              <h3 className="font-bold text-base">Register Fleet Assets</h3>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1 leading-relaxed">
                Add trucks, delivery vans, and haulers. Specify payload capacity, odometer readings, and purchase costs in ₹.
              </p>
            </div>
          </div>

          <div className="pt-4 mt-2">
            <button
              onClick={onOpenAddVehicleModal}
              className={`w-full py-2.5 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-all ${
                hasVehicles
                  ? isDark
                    ? 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700'
                    : 'bg-neutral-200 text-neutral-700 hover:bg-neutral-300'
                  : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/20'
              }`}
            >
              <span>{hasVehicles ? '+ Add Another Vehicle' : '+ Register First Vehicle'}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Step 2: Drivers */}
        <div
          className={`flex flex-col justify-between p-5 rounded-xl border transition-all ${
            hasDrivers
              ? isDark
                ? 'bg-emerald-950/20 border-emerald-500/30'
                : 'bg-emerald-50/50 border-emerald-200'
              : isDark
              ? 'bg-neutral-800/40 border-neutral-700/60 hover:border-neutral-600'
              : 'bg-neutral-50 border-neutral-200 hover:border-neutral-300'
          }`}
        >
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                  hasDrivers
                    ? 'bg-emerald-500/20 text-emerald-400'
                    : 'bg-neutral-200 dark:bg-neutral-800 text-neutral-500'
                }`}
              >
                <Users className="w-5 h-5" />
              </div>
              {hasDrivers ? (
                <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-500">
                  <CheckCircle2 className="w-4 h-4" /> Done ({drivers.length})
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-xs font-medium text-neutral-400">
                  <Circle className="w-3.5 h-3.5" /> Step 2
                </span>
              )}
            </div>
            <div>
              <h3 className="font-bold text-base">Onboard Drivers</h3>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1 leading-relaxed">
                Log commercial licenses, validity dates, phone numbers, and baseline safety compliance ratings.
              </p>
            </div>
          </div>

          <div className="pt-4 mt-2">
            <button
              onClick={onOpenAddDriverModal}
              className={`w-full py-2.5 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-all ${
                hasDrivers
                  ? isDark
                    ? 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700'
                    : 'bg-neutral-200 text-neutral-700 hover:bg-neutral-300'
                  : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/20'
              }`}
            >
              <span>{hasDrivers ? '+ Add Another Driver' : '+ Onboard First Driver'}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Step 3: Trips */}
        <div
          className={`flex flex-col justify-between p-5 rounded-xl border transition-all ${
            hasTrips
              ? isDark
                ? 'bg-emerald-950/20 border-emerald-500/30'
                : 'bg-emerald-50/50 border-emerald-200'
              : isDark
              ? 'bg-neutral-800/40 border-neutral-700/60 hover:border-neutral-600'
              : 'bg-neutral-50 border-neutral-200 hover:border-neutral-300'
          }`}
        >
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                  hasTrips
                    ? 'bg-emerald-500/20 text-emerald-400'
                    : 'bg-neutral-200 dark:bg-neutral-800 text-neutral-500'
                }`}
              >
                <Route className="w-5 h-5" />
              </div>
              {hasTrips ? (
                <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-500">
                  <CheckCircle2 className="w-4 h-4" /> Done ({trips.length})
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-xs font-medium text-neutral-400">
                  <Circle className="w-3.5 h-3.5" /> Step 3
                </span>
              )}
            </div>
            <div>
              <h3 className="font-bold text-base">Create & Dispatch Trips</h3>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1 leading-relaxed">
                Connect vehicles to licensed drivers, set origin/destination corridors, cargo weights, and billing in ₹ INR.
              </p>
            </div>
          </div>

          <div className="pt-4 mt-2">
            <button
              onClick={onOpenNewTripModal}
              disabled={!hasVehicles || !hasDrivers}
              className={`w-full py-2.5 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-all ${
                !hasVehicles || !hasDrivers
                  ? 'bg-neutral-200 dark:bg-neutral-800 text-neutral-400 dark:text-neutral-500 cursor-not-allowed opacity-60'
                  : hasTrips
                  ? isDark
                    ? 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700'
                    : 'bg-neutral-200 text-neutral-700 hover:bg-neutral-300'
                  : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/20'
              }`}
            >
              <span>{hasTrips ? '+ Dispatch Another Trip' : 'Create First Dispatch'}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Security & Multi-Tenancy Guarantee Footer */}
      <div className="mt-4 pt-4 border-t border-inherit flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-neutral-500 dark:text-neutral-400">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-500" />
          <span>Tenant-scoped API access is enforced; the browser never connects directly to PostgreSQL.</span>
        </div>
        <div className="flex items-center gap-2">
          <Building2 className="w-4 h-4 text-blue-500" />
          <span>Backend queries are scoped to the authenticated tenant.</span>
        </div>
      </div>
    </div>
  );
};

const SafetyOfficerGettingStartedGuide: React.FC = () => {
  const { currentUser, drivers, maintenanceRecords, setActiveView } = useApp();
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const today = new Date().toISOString().slice(0, 10);
  const expiringCutoff = new Date();
  expiringCutoff.setDate(expiringCutoff.getDate() + 30);
  const expiringCutoffDate = expiringCutoff.toISOString().slice(0, 10);
  const expiredCount = drivers.filter(driver => driver.licenseExpiryDate < today).length;
  const expiringCount = drivers.filter(
    driver => driver.licenseExpiryDate >= today && driver.licenseExpiryDate <= expiringCutoffDate,
  ).length;
  const suspendedCount = drivers.filter(driver => driver.status === 'Suspended').length;
  const activeMaintenanceCount = maintenanceRecords.filter(record => record.status === 'Active').length;
  const cardClass = `rounded-2xl border p-6 sm:p-8 ${
    isDark ? 'border-neutral-800 bg-neutral-900/90 shadow-2xl shadow-black/40' : 'border-neutral-200 bg-white shadow-xl shadow-neutral-200/50'
  }`;
  const actionClass = `mt-4 inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-xs font-bold transition-colors ${
    isDark ? 'bg-purple-500/15 text-purple-300 hover:bg-purple-500/25' : 'bg-purple-50 text-purple-800 hover:bg-purple-100'
  }`;

  return (
    <section className={cardClass} aria-labelledby="safety-guide-title">
      <div className="flex flex-col gap-5 border-b border-inherit pb-6 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-purple-500/25 bg-purple-500/10 px-3 py-1 text-xs font-semibold text-purple-500">
            <ShieldCheck className="h-3.5 w-3.5" />
            Safety &amp; Compliance Workspace
          </span>
          <h2 id="safety-guide-title" className="mt-3 text-xl font-extrabold tracking-tight sm:text-2xl">
            Welcome, {currentUser?.name || 'Safety Officer'}
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-neutral-500 dark:text-neutral-400">
            Review driver licence compliance, monitor safety status, and follow up on active vehicle maintenance. Your role can manage compliance actions, but does not create trips or fleet assets.
          </p>
        </div>
        <div className={`shrink-0 rounded-xl border px-4 py-3 text-sm ${
          isDark ? 'border-neutral-700 bg-neutral-800/60' : 'border-neutral-200 bg-neutral-50'
        }`}>
          <div className="text-xs text-neutral-500">Organization drivers</div>
          <div className="mt-1 font-bold">{drivers.length} in your review queue</div>
        </div>
      </div>

      <div className="grid gap-4 pt-6 md:grid-cols-2">
        <article className={`rounded-xl border p-5 ${
          isDark ? 'border-neutral-700 bg-neutral-800/40' : 'border-neutral-200 bg-neutral-50'
        }`}>
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-purple-400" />
            <h3 className="font-bold">1. Review driver compliance</h3>
          </div>
          <p className="mt-2 text-xs leading-relaxed text-neutral-500 dark:text-neutral-400">
            Check expired or soon-to-expire licences and suspended drivers. Send licence reminders and suspend or reinstate drivers when required.
          </p>
          <div className="mt-3 flex flex-wrap gap-2 text-xs">
            <span className="rounded-full bg-red-500/10 px-2.5 py-1 font-semibold text-red-500">{expiredCount} expired</span>
            <span className="rounded-full bg-amber-500/10 px-2.5 py-1 font-semibold text-amber-500">{expiringCount} expiring soon</span>
            <span className="rounded-full bg-neutral-500/10 px-2.5 py-1 font-semibold text-neutral-500">{suspendedCount} suspended</span>
          </div>
          <button type="button" onClick={() => setActiveView('drivers')} className={actionClass}>
            Open driver compliance <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </article>

        <article className={`rounded-xl border p-5 ${
          isDark ? 'border-neutral-700 bg-neutral-800/40' : 'border-neutral-200 bg-neutral-50'
        }`}>
          <div className="flex items-center gap-2">
            <Wrench className="h-5 w-5 text-amber-400" />
            <h3 className="font-bold">2. Monitor maintenance safety</h3>
          </div>
          <p className="mt-2 text-xs leading-relaxed text-neutral-500 dark:text-neutral-400">
            Review vehicles with active maintenance and track repair status. Fleet Managers handle trip scheduling and fleet-asset setup.
          </p>
          <div className="mt-3 text-xs font-semibold text-neutral-500">
            {activeMaintenanceCount} active maintenance {activeMaintenanceCount === 1 ? 'record' : 'records'}
          </div>
          <button type="button" onClick={() => setActiveView('maintenance')} className={actionClass}>
            Open maintenance overview <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </article>
      </div>

      <p className="mt-5 flex items-start gap-2 border-t border-inherit pt-4 text-xs leading-relaxed text-neutral-500 dark:text-neutral-400">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
        Your account is scoped to your organization. Compliance actions are recorded by the API; trip dispatch and vehicle or driver creation remain with authorized operations roles.
      </p>
    </section>
  );
};
