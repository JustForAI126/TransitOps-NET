import React from 'react';
import {
  Navigation,
  Clock,
  Truck,
  Users,
  CheckCircle2,
  Send,
  Download,
  ArrowUpRight,
  Package,
  FileText,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useTheme } from '../../context/ThemeContext';
import { Trip } from '../../types';
import { LiveRouteRadar } from './LiveRouteRadar';

interface DriverDashboardProps {
  onOpenNewTripModal: () => void;
  onOpenCompleteTripModal: (trip: Trip) => void;
}

export const DriverDashboard: React.FC<DriverDashboardProps> = ({
  onOpenNewTripModal,
  onOpenCompleteTripModal,
}) => {
  const {
    trips,
    vehicles,
    drivers,
    dispatchTrip,
    cancelTrip,
    exportToCSV,
    setActiveView,
  } = useApp();
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const activeDeliveries = trips.filter((t) => t.status === 'Dispatched');
  const pendingDispatches = trips.filter((t) => t.status === 'Draft');
  const completedTrips = trips.filter((t) => t.status === 'Completed');
  const availableVehicles = vehicles.filter((v) => v.status === 'Available');
  const onDutyDrivers = drivers.filter(
    (d) => d.status !== 'Suspended' && d.licenseExpiryDate >= new Date().toISOString().split('T')[0]
  );

  const handleExportManifest = () => {
    const manifest = trips.map((t) => ({
      TripCode: t.tripCode,
      Route: `${t.source} -> ${t.destination}`,
      Vehicle: `${t.vehicleName} (${t.vehicleRegNumber})`,
      Driver: t.driverName,
      CargoWeightKg: t.cargoWeightKg,
      DistanceKm: t.plannedDistanceKm,
      Status: t.status,
    }));
    exportToCSV('transitops-dispatch-manifest', manifest);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Quick Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-mono text-neutral-400 mb-1">
            <span>TRANSITOPS</span>
            <span>/</span>
            <span className="font-semibold text-emerald-500">
              DRIVER &amp; DISPATCH DESK
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            Active Deliveries &amp; Dispatch Console
          </h1>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={handleExportManifest}
            className={`px-3 py-2 rounded-xl text-xs font-semibold border flex items-center gap-1.5 transition-colors ${
              isDark
                ? 'bg-[#151921] border-[#262d3a] hover:bg-[#1d232f] text-neutral-300'
                : 'bg-white border-[#ded7ca] hover:bg-neutral-100 text-neutral-700'
            }`}
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export Manifest</span>
          </button>

          <button
            onClick={onOpenNewTripModal}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-md flex items-center gap-1.5 ${
              isDark
                ? 'bg-emerald-400 text-black hover:bg-emerald-300 shadow-[0_0_15px_rgba(52,211,153,0.2)]'
                : 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-emerald-600/20'
            }`}
          >
            <Send className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>New Dispatch</span>
          </button>
        </div>
      </div>

      {/* Driver/Dispatcher KPIs Row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
        <div
          className={`p-4 rounded-xl border flex flex-col justify-between ${
            isDark ? 'bg-[#14171e] border-[#252b36]' : 'bg-white border-[#e5dfd2] shadow-xs'
          }`}
        >
          <div className="flex items-center justify-between text-neutral-400 mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider">Active Deliveries</span>
            <Navigation className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-black font-mono text-amber-400">{activeDeliveries.length}</div>
          <div className="text-[11px] text-neutral-500 mt-1">On road right now</div>
        </div>

        <div
          className={`p-4 rounded-xl border flex flex-col justify-between ${
            isDark ? 'bg-[#14171e] border-[#252b36]' : 'bg-white border-[#e5dfd2] shadow-xs'
          }`}
        >
          <div className="flex items-center justify-between text-neutral-400 mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider">Pending Departure</span>
            <Clock className="w-4 h-4 text-purple-400" />
          </div>
          <div className="text-2xl font-black font-mono">{pendingDispatches.length}</div>
          <div className="text-[11px] text-neutral-500 mt-1">Awaiting dispatch</div>
        </div>

        <div
          className={`p-4 rounded-xl border flex flex-col justify-between ${
            isDark ? 'bg-[#14171e] border-[#252b36]' : 'bg-white border-[#e5dfd2] shadow-xs'
          }`}
        >
          <div className="flex items-center justify-between text-neutral-400 mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider">Available Assets</span>
            <Truck className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-black font-mono">{availableVehicles.length}</div>
          <div className="text-[11px] text-neutral-500 mt-1">Ready for assignment</div>
        </div>

        <div
          className={`p-4 rounded-xl border flex flex-col justify-between ${
            isDark ? 'bg-[#14171e] border-[#252b36]' : 'bg-white border-[#e5dfd2] shadow-xs'
          }`}
        >
          <div className="flex items-center justify-between text-neutral-400 mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider">Drivers On Duty</span>
            <Users className="w-4 h-4 text-blue-400" />
          </div>
          <div className="text-2xl font-black font-mono">{onDutyDrivers.length}</div>
          <div className="text-[11px] text-neutral-500 mt-1">Available for routes</div>
        </div>

        <div
          className={`p-4 rounded-xl border flex flex-col justify-between ${
            isDark ? 'bg-[#14171e] border-[#252b36]' : 'bg-white border-[#e5dfd2] shadow-xs'
          }`}
        >
          <div className="flex items-center justify-between text-neutral-400 mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider">Delivered Runs</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-black font-mono">{completedTrips.length}</div>
          <div className="text-[11px] text-neutral-500 mt-1">Successfully closed</div>
        </div>
      </div>

      {/* Main Grid: Live Route Radar + Dispatch Queue Attention */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8">
          <LiveRouteRadar
            title="Active Dispatch Route Radar"
            subtitle="Real-time transit corridors and road progress"
          />
        </div>

        {/* Dispatch Queue & Cargo Rules */}
        <div
          className={`lg:col-span-4 p-5 sm:p-6 rounded-2xl border flex flex-col justify-between space-y-4 ${
            isDark ? 'bg-[#14171e] border-[#252b36]' : 'bg-white border-[#e5dfd2] shadow-sm'
          }`}
        >
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Package className="w-5 h-5 text-emerald-400" />
                <h3 className="font-bold text-base">Departure Queue</h3>
              </div>
              <span className="text-xs font-mono px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/20 font-bold">
                {pendingDispatches.length} Pending
              </span>
            </div>
            <p className="text-xs text-neutral-400 mb-4">
              Dispatches ready for departure. Confirm manifest and launch transit.
            </p>

            <div className="space-y-3">
              {pendingDispatches.length === 0 ? (
                <div
                  className={`p-4 rounded-xl border text-center text-xs ${
                    isDark ? 'bg-[#161a22] border-[#232938] text-neutral-400' : 'bg-neutral-50 border-[#ded7ca] text-neutral-600'
                  }`}
                >
                  <CheckCircle2 className="w-6 h-6 text-emerald-400 mx-auto mb-1.5" />
                  <p className="font-bold">No Pending Dispatches</p>
                  <p className="text-[11px] text-neutral-400">All planned cargo is currently in transit or completed.</p>
                </div>
              ) : (
                pendingDispatches.map((t) => (
                  <div
                    key={t.id}
                    className={`p-3 rounded-xl border text-xs ${
                      isDark
                        ? 'bg-[#181c25] border-[#28303f] text-neutral-200'
                        : 'bg-neutral-50 border-[#ded7ca] text-neutral-900'
                    }`}
                  >
                    <div className="flex items-center justify-between font-bold mb-1">
                      <span className="font-mono text-emerald-400">{t.tripCode}</span>
                      <span className="text-[11px] text-neutral-400">{t.cargoWeightKg.toLocaleString()} kg</span>
                    </div>
                    <div className="text-[11px] font-semibold mb-1">
                      {t.source} → {t.destination}
                    </div>
                    <div className="text-[10px] text-neutral-400 flex items-center justify-between">
                      <span>{t.vehicleName} · {t.driverName}</span>
                      <button
                        onClick={() => dispatchTrip(t.id)}
                        className={`px-2.5 py-1 rounded-md text-[10px] font-bold ${
                          isDark
                            ? 'bg-emerald-400 text-black hover:bg-emerald-300'
                            : 'bg-emerald-600 text-white hover:bg-emerald-700'
                        }`}
                      >
                        Dispatch Now
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div
            className={`p-3.5 rounded-xl text-[11px] leading-relaxed border ${
              isDark ? 'bg-[#161a22] border-[#222733] text-neutral-400' : 'bg-neutral-100 border-[#ded7ca] text-neutral-600'
            }`}
          >
            <div className="flex items-center gap-1.5 font-bold text-neutral-300 mb-1">
              <FileText className="w-3.5 h-3.5 text-emerald-400" />
              <span>Driver Turn-In Protocol</span>
            </div>
            When concluding a route, click <strong>Complete Delivery</strong> to register final odometer reading and liters of fuel consumed.
          </div>
        </div>
      </div>

      {/* Dispatches Execution Table */}
      <div
        className={`p-5 sm:p-6 rounded-2xl border ${
          isDark ? 'bg-[#14171e] border-[#252b36]' : 'bg-white border-[#e5dfd2] shadow-sm'
        }`}
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 mb-4 border-b border-inherit gap-2">
          <div>
            <h3 className="font-bold text-base">Active Trips &amp; Delivery Desk</h3>
            <p className="text-xs text-neutral-400">
              Manage live trips, execute dispatches, and record delivery completions
            </p>
          </div>
          <button
            onClick={() => setActiveView('trips')}
            className={`text-xs font-bold hover:underline flex items-center gap-1 ${
              isDark ? 'text-emerald-400' : 'text-emerald-600'
            }`}
          >
            <span>All Trips ({trips.length})</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-inherit text-[10px] uppercase font-bold text-neutral-400 tracking-wider">
                <th className="pb-3 pl-2">Trip Code</th>
                <th className="pb-3">Route</th>
                <th className="pb-3">Assigned Vehicle</th>
                <th className="pb-3">Driver</th>
                <th className="pb-3">Cargo Weight</th>
                <th className="pb-3">Status</th>
                <th className="pb-3 text-right pr-2">Execution Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-inherit font-medium">
              {trips.slice(0, 6).map((t) => {
                const isDispatched = t.status === 'Dispatched';
                const isDraft = t.status === 'Draft';
                const isCompleted = t.status === 'Completed';

                return (
                  <tr
                    key={t.id}
                    className={`transition-colors ${
                      isDark ? 'hover:bg-[#181d27]' : 'hover:bg-neutral-50'
                    }`}
                  >
                    <td className="py-3 pl-2 font-mono font-bold">{t.tripCode}</td>
                    <td className="py-3">
                      <div className="font-bold">{t.source}</div>
                      <div className="text-[11px] text-neutral-400">→ {t.destination}</div>
                    </td>
                    <td className="py-3">
                      <div className="font-semibold">{t.vehicleName}</div>
                      <div className="text-[10px] font-mono text-neutral-400">{t.vehicleRegNumber}</div>
                    </td>
                    <td className="py-3 font-semibold">{t.driverName}</td>
                    <td className="py-3 font-mono">{t.cargoWeightKg.toLocaleString()} kg</td>
                    <td className="py-3">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold ${
                          isDispatched
                            ? isDark
                              ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                              : 'bg-amber-100 text-amber-800'
                            : isCompleted
                            ? isDark
                              ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                              : 'bg-emerald-100 text-emerald-800'
                            : isDark
                            ? 'bg-neutral-800 text-neutral-300'
                            : 'bg-neutral-200 text-neutral-800'
                        }`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            isDispatched
                              ? 'bg-amber-400 animate-ping'
                              : isCompleted
                              ? 'bg-emerald-400'
                              : 'bg-neutral-400'
                          }`}
                        />
                        <span>{t.status}</span>
                      </span>
                    </td>
                    <td className="py-3 text-right pr-2">
                      {isDispatched && (
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => onOpenCompleteTripModal(t)}
                            className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-emerald-600 hover:bg-emerald-500 text-white transition-colors"
                          >
                            Complete Delivery
                          </button>
                          <button
                            onClick={() => cancelTrip(t.id)}
                            className="px-2 py-1 rounded-lg text-[11px] text-red-400 hover:bg-red-500/10 transition-colors"
                          >
                            Cancel
                          </button>
                        </div>
                      )}
                      {isDraft && (
                        <button
                          onClick={() => dispatchTrip(t.id)}
                          className={`px-3 py-1 rounded-lg text-[11px] font-bold transition-all ${
                            isDark
                              ? 'bg-emerald-400 text-black hover:bg-emerald-300'
                              : 'bg-emerald-600 text-white hover:bg-emerald-700'
                          }`}
                        >
                          Dispatch Now
                        </button>
                      )}
                      {isCompleted && (
                        <span className="text-[11px] text-neutral-400 font-mono">
                          Finished ({t.finalOdometerKm} km)
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
