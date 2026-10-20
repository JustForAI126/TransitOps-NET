import React, { useState } from 'react';
import {
  Route,
  Plus,
  Search,
  CheckCircle2,
  Clock,
  XCircle,
  Send,
  Download,
  Fuel,
  Gauge,
  Weight,
  MapPin,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useTheme } from '../../context/ThemeContext';
import { Trip, TripStatus } from '../../types';
import { formatRupees } from '../../utils/currency';
import { api } from '../../services/api';

interface TripsViewProps {
  onOpenNewTripModal: () => void;
  onOpenCompleteTripModal: (trip: Trip) => void;
}

export const TripsView: React.FC<TripsViewProps> = ({
  onOpenNewTripModal,
  onOpenCompleteTripModal,
}) => {
  const { trips, vehicles, currentUser, dispatchTrip, cancelTrip, exportToCSV } = useApp();
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const canManageTrips = currentUser?.role === 'fleet_manager';
  const canCompleteTrips = canManageTrips || currentUser?.role === 'driver';
  const canDownloadTripReceipt = canCompleteTrips;
  const canExportTrips = currentUser?.role === 'fleet_manager' || currentUser?.role === 'financial_analyst';
  const canViewFinancials = currentUser?.role === 'fleet_manager' || currentUser?.role === 'financial_analyst';

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [downloadingReceiptFor, setDownloadingReceiptFor] = useState<string | null>(null);
  const [receiptError, setReceiptError] = useState<string | null>(null);

  const downloadTurnInReceipt = async (trip: Trip) => {
    setReceiptError(null);
    setDownloadingReceiptFor(trip.id);
    try {
      const pdf = await api.reports.exportTripReceiptPdf(trip.id);
      const url = URL.createObjectURL(pdf);
      const link = document.createElement('a');
      link.href = url;
      link.download = `transitops-receipt-${trip.tripCode}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) {
      setReceiptError(error instanceof Error ? error.message : 'Could not generate the trip receipt.');
    } finally {
      setDownloadingReceiptFor(null);
    }
  };

  const filteredTrips = trips.filter((t) => {
    const matchSearch =
      t.tripCode.toLowerCase().includes(search.toLowerCase()) ||
      t.vehicleName.toLowerCase().includes(search.toLowerCase()) ||
      t.driverName.toLowerCase().includes(search.toLowerCase()) ||
      t.source.toLowerCase().includes(search.toLowerCase()) ||
      t.destination.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'All' || t.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const handleExport = () => {
    const exportData = filteredTrips.map((t) => ({
      'Trip Code': t.tripCode,
      Source: t.source,
      Destination: t.destination,
      Vehicle: `${t.vehicleName} (${t.vehicleRegNumber})`,
      Driver: t.driverName,
      'Cargo (kg)': t.cargoWeightKg,
      'Distance (km)': t.plannedDistanceKm,
      ...(canViewFinancials ? { 'Revenue (₹)': t.revenue } : {}),
      Status: t.status,
      'Created At': t.createdAt,
      'Dispatched At': t.dispatchedAt || 'N/A',
      'Completed At': t.completedAt || 'N/A',
      'Final Odometer (km)': t.finalOdometerKm || 'N/A',
      'Fuel Consumed (L)': t.fuelConsumedLiters || 'N/A',
    }));
    exportToCSV('transitops-trips-manifest', exportData);
  };

  const getStatusBadge = (status: TripStatus | string) => {
    switch (status) {
      case 'Draft':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-neutral-500/15 text-neutral-400 border border-neutral-500/20">
            <Clock className="w-3 h-3" />
            Draft
          </span>
        );
      case 'Dispatched':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping" />
            Dispatched
          </span>
        );
      case 'Completed':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
            <CheckCircle2 className="w-3 h-3" />
            Completed
          </span>
        );
      case 'Cancelled':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-red-500/15 text-red-400 border border-red-500/30">
            <XCircle className="w-3 h-3" />
            Cancelled
          </span>
        );
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-mono text-neutral-400 mb-1">
            <span>TRANSITOPS</span>
            <span>/</span>
            <span className={`font-semibold ${isDark ? 'text-[#ccff00]' : 'text-[#d97706]'}`}>
              {currentUser?.role === 'driver' ? 'MY ASSIGNMENTS' : 'DISPATCH DESK'}
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            {currentUser?.role === 'driver' ? 'My Assigned Trips' : 'Trip Manifest & Live Dispatches'}
          </h1>
        </div>

        <div className="flex items-center gap-2.5">
          {canExportTrips && (
            <button
              onClick={handleExport}
              className={`px-3 py-2 rounded-xl text-xs font-semibold border flex items-center gap-1.5 transition-colors ${
                isDark
                  ? 'bg-[#151921] border-[#262d3a] hover:bg-[#1d232f] text-neutral-200'
                  : 'bg-white border-[#ded7ca] hover:bg-neutral-100 text-neutral-800'
              }`}
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export Manifest</span>
            </button>
          )}
          {canManageTrips && (
            <button
              onClick={onOpenNewTripModal}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-md flex items-center gap-1.5 ${
                isDark
                  ? 'bg-[#ccff00] text-black hover:bg-[#bbf000]'
                  : 'bg-[#d97706] text-white hover:bg-[#b45309]'
              }`}
            >
              <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>Create Trip</span>
            </button>
          )}
        </div>
      </div>
      {receiptError && (
        <p role="alert" className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-xs text-red-500">
          {receiptError}
        </p>
      )}

      {/* Filter and Search Bar */}
      <div
        className={`p-4 rounded-2xl border flex flex-col md:flex-row gap-3 items-center justify-between text-xs ${
          isDark ? 'bg-[#14171e] border-[#252b36]' : 'bg-white border-[#e5dfd2]'
        }`}
      >
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-neutral-400" />
          <input
            type="text"
            placeholder="Search trip code, route, vehicle, driver..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={`w-full pl-9 pr-3 py-2 rounded-xl border outline-none font-medium ${
              isDark
                ? 'bg-[#191d26] border-[#272e3d] focus:border-[#ccff00] text-neutral-200'
                : 'bg-neutral-50 border-[#ded7ca] focus:border-[#d97706] text-neutral-800'
            }`}
          />
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[10px] uppercase font-bold text-neutral-400">Trip Status:</span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className={`px-2.5 py-1.5 rounded-lg border outline-none font-medium ${
              isDark
                ? 'bg-[#191d26] border-[#272e3d] text-neutral-200'
                : 'bg-neutral-50 border-[#ded7ca] text-neutral-800'
            }`}
          >
            <option value="All">All Dispatches</option>
            <option value="Draft">Draft</option>
            <option value="Dispatched">Dispatched (In Transit)</option>
            <option value="Completed">Completed</option>
            <option value="Cancelled">Cancelled</option>
          </select>
        </div>
      </div>

      {/* Trips Table */}
      <div
        className={`rounded-2xl border overflow-hidden ${
          isDark ? 'bg-[#14171e] border-[#252b36]' : 'bg-white border-[#e5dfd2] shadow-sm'
        }`}
      >
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-inherit text-[10px] uppercase font-bold text-neutral-400 tracking-wider">
                <th className="py-3 pl-4">Trip Code</th>
                <th className="py-3">Origin &amp; Destination</th>
                <th className="py-3">Vehicle</th>
                <th className="py-3">Driver</th>
                <th className="py-3">Cargo Load</th>
                {canViewFinancials && <th className="py-3">Est. Revenue</th>}
                <th className="py-3">Status</th>
                <th className="py-3 text-right pr-4">
                  {canCompleteTrips ? 'Trip Action' : 'Trip Details'}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-inherit">
              {filteredTrips.length === 0 ? (
                <tr>
                  <td colSpan={canViewFinancials ? 9 : 8} className="py-12 text-center text-neutral-400">
                    <div className="max-w-sm mx-auto space-y-2">
                      <Route className="w-10 h-10 mx-auto opacity-40 text-amber-500" />
                      <p className="font-bold text-sm">No Dispatches Scheduled</p>
                      <p className="text-xs">
                        {currentUser?.role === 'driver'
                          ? 'No trips are currently assigned to your driver account.'
                          : canManageTrips
                          ? 'No active or draft trips in this workspace. Plan your first cargo route.'
                          : 'No trips are available in this workspace.'}
                      </p>
                      {canManageTrips && (
                        <button
                          onClick={onOpenNewTripModal}
                          className="mt-2 px-3 py-1.5 text-xs font-bold rounded-lg bg-amber-500 hover:bg-amber-600 text-black inline-flex items-center gap-1.5 transition-colors"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Schedule First Dispatch</span>
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                filteredTrips.map((t) => {
                  const vehicle = vehicles.find((v) => v.id === t.vehicleId);
                  const maxCap = vehicle?.maxCapacityKg || 1500;
                  const loadPercent = Math.min(100, Math.round((t.cargoWeightKg / maxCap) * 100));

                  return (
                    <tr
                      key={t.id}
                      className={`transition-colors ${
                        isDark ? 'hover:bg-[#181d27]' : 'hover:bg-neutral-50'
                      }`}
                    >
                      <td className="py-3.5 pl-4 font-mono font-bold text-sm">
                        {t.tripCode}
                        <div className="text-[10px] text-neutral-400 font-normal">
                          {t.createdAt}
                        </div>
                      </td>
                      <td className="py-3.5">
                        <div className="flex items-center gap-1.5 font-bold">
                          <MapPin className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                          <span>{t.source}</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-neutral-400 text-[11px] mt-0.5">
                          <span className="text-blue-400">↳</span>
                          <span>{t.destination} ({t.plannedDistanceKm} km)</span>
                        </div>
                      </td>
                      <td className="py-3.5">
                        <div className="font-semibold">{t.vehicleName}</div>
                        <div className="text-[10px] font-mono text-neutral-400">
                          {t.vehicleRegNumber}
                        </div>
                      </td>
                      <td className="py-3.5">
                        <div className="font-semibold">{t.driverName}</div>
                      </td>
                      <td className="py-3.5">
                        <div className="font-mono font-bold">{t.cargoWeightKg.toLocaleString()} kg</div>
                        <div className="w-24 h-1.5 bg-neutral-700/30 rounded-full overflow-hidden mt-1">
                          <div
                            className={`h-full rounded-full ${
                              loadPercent > 90 ? 'bg-amber-400' : 'bg-emerald-400'
                            }`}
                            style={{ width: `${loadPercent}%` }}
                          />
                        </div>
                        <span className="text-[10px] text-neutral-400">{loadPercent}% capacity</span>
                      </td>
                      {canViewFinancials && (
                        <td className="py-3.5 font-mono font-bold text-emerald-400">
                          {t.revenue === null ? '—' : formatRupees(t.revenue)}
                        </td>
                      )}
                    <td className="py-3.5">{getStatusBadge(t.status)}</td>
                    <td className="py-3.5 text-right pr-4">
                      {canManageTrips && t.status === 'Draft' && (
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => dispatchTrip(t.id)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all shadow-xs flex items-center gap-1 ${
                              isDark
                                ? 'bg-[#ccff00] text-black hover:bg-[#bbf000]'
                                : 'bg-[#d97706] text-white hover:bg-[#b45309]'
                            }`}
                          >
                            <Send className="w-3 h-3" />
                            <span>Dispatch</span>
                          </button>
                          <button
                            onClick={() => cancelTrip(t.id)}
                            className="text-xs text-red-400 hover:underline"
                          >
                            Cancel
                          </button>
                        </div>
                      )}
                      {canCompleteTrips && t.status === 'Dispatched' && (
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => onOpenCompleteTripModal(t)}
                            className="px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white transition-colors flex items-center gap-1"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Complete Delivery</span>
                          </button>
                          {canManageTrips && (
                            <button
                              onClick={() => cancelTrip(t.id)}
                              className="text-xs text-red-400 hover:underline"
                            >
                              Abort
                            </button>
                          )}
                        </div>
                      )}
                      {t.status === 'Completed' && (
                        <div className="text-[11px] text-neutral-400 space-y-1">
                          <div>Final: {t.finalOdometerKm?.toLocaleString()} km</div>
                          <div>Fuel: {t.fuelConsumedLiters} L</div>
                          {canDownloadTripReceipt && (
                            <button
                              onClick={() => void downloadTurnInReceipt(t)}
                              disabled={downloadingReceiptFor === t.id}
                              className="inline-flex items-center gap-1 pt-1 text-emerald-500 hover:underline disabled:opacity-50"
                            >
                              <Download className="w-3 h-3" />
                              {downloadingReceiptFor === t.id ? 'Generating…' : 'PDF receipt'}
                            </button>
                          )}
                        </div>
                      )}
                      {t.status === 'Cancelled' && (
                        <span className="text-xs text-neutral-500 font-mono">Trip Voided</span>
                      )}
                    </td>
                  </tr>
                );
              }))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
