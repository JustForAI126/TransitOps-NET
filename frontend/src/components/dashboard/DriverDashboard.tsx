import React from 'react';
import {
  Navigation,
  Clock,
  CheckCircle2,
  Download,
  ArrowUpRight,
  FileText,
  RefreshCw,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useTheme } from '../../context/ThemeContext';
import { Trip } from '../../types';

interface DriverDashboardProps {
  onOpenCompleteTripModal: (trip: Trip) => void;
}

export const DriverDashboard: React.FC<DriverDashboardProps> = ({
  onOpenCompleteTripModal,
}) => {
  const {
    trips,
    exportToCSV,
    setActiveView,
    refreshData,
  } = useApp();
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const activeDeliveries = trips.filter((t) => t.status === 'Dispatched');
  const pendingDispatches = trips.filter((t) => t.status === 'Draft');
  const completedTrips = trips.filter((t) => t.status === 'Completed');

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
              DRIVER WORKSPACE
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            My Assigned Trips
          </h1>
          <p className="mt-1 text-xs text-neutral-400">
            Review your assignments and record delivery details when a trip is dispatched.
          </p>
        </div>

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
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        <div
          className={`p-4 rounded-xl border flex flex-col justify-between ${
            isDark ? 'bg-[#14171e] border-[#252b36]' : 'bg-white border-[#e5dfd2] shadow-xs'
          }`}
        >
          <div className="flex items-center justify-between text-neutral-400 mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider">In Transit</span>
            <Navigation className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-black font-mono text-amber-400">{activeDeliveries.length}</div>
          <div className="text-[11px] text-neutral-500 mt-1">Your dispatched trips</div>
        </div>

        <div
          className={`p-4 rounded-xl border flex flex-col justify-between ${
            isDark ? 'bg-[#14171e] border-[#252b36]' : 'bg-white border-[#e5dfd2] shadow-xs'
          }`}
        >
          <div className="flex items-center justify-between text-neutral-400 mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider">Upcoming Assignments</span>
            <Clock className="w-4 h-4 text-purple-400" />
          </div>
          <div className="text-2xl font-black font-mono">{pendingDispatches.length}</div>
          <div className="text-[11px] text-neutral-500 mt-1">Awaiting Fleet Manager dispatch</div>
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

      <div
        className={`rounded-xl border p-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between ${
          isDark ? 'bg-[#14171e] border-[#252b36]' : 'bg-white border-[#e5dfd2]'
        }`}
      >
        <p className="flex items-start gap-2 text-xs leading-relaxed text-neutral-400">
          <FileText className="mt-0.5 w-4 h-4 shrink-0 text-emerald-400" />
          Trip status refreshes automatically. Complete a dispatched trip after delivery to record your final odometer and fuel used.
        </p>
        <button
          type="button"
          onClick={() => void refreshData()}
          className={`inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold transition-colors ${
            isDark
              ? 'border-[#262d3a] bg-[#151921] text-neutral-300 hover:bg-[#1d232f]'
              : 'border-[#ded7ca] bg-white text-neutral-700 hover:bg-neutral-100'
          }`}
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Refresh trips
        </button>
      </div>

      {/* Each assigned trip appears once in this table. */}
      <div
        className={`p-5 sm:p-6 rounded-2xl border ${
          isDark ? 'bg-[#14171e] border-[#252b36]' : 'bg-white border-[#e5dfd2] shadow-sm'
        }`}
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 mb-4 border-b border-inherit gap-2">
          <div>
            <h3 className="font-bold text-base">Assigned Trips</h3>
            <p className="text-xs text-neutral-400">
              View only trips assigned to your driver account. Complete a dispatched trip after delivery.
            </p>
          </div>
          <button
            onClick={() => setActiveView('trips')}
            className={`text-xs font-bold hover:underline flex items-center gap-1 ${
              isDark ? 'text-emerald-400' : 'text-emerald-600'
            }`}
          >
            <span>My Trips ({trips.length})</span>
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
                <th className="pb-3 text-right pr-2">Delivery Action</th>
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
                        </div>
                      )}
                      {isDraft && <span className="text-[11px] text-amber-500">Awaiting dispatch</span>}
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
